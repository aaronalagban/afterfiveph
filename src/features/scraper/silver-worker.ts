import { supabase } from "../../lib/supabase";
import { logger } from "../../lib/logger";
import { imageService } from "./image.service";
import { chainedClassifier, ChainedExtractionResult, ExtractedEvent } from "./chained-classifier";
import { generateImageHash, isNearDuplicate } from "./phash";
import { validator } from "./validator";
import { publishEvent } from "../events/event-publisher";

/** Auto-publish threshold — events above this go straight to the events table. */
const CONFIDENCE_THRESHOLD = Number(process.env.CONFIDENCE_THRESHOLD) || 0.85;

/** Number of PENDING rows to process per worker invocation. */
const BATCH_SIZE = Number(process.env.WORKER_BATCH_SIZE) || 15;

/** ms to wait between posts so we stay inside Gemini's rate limits. */
const RATE_LIMIT_DELAY = Number(process.env.GEMINI_DELAY_MS) || 1500;

interface PendingRow {
  id: string;
  ig_post_url: string;
  image_url: string;
  club_name: string;
  city: string;
  source_username: string | null;
  raw_caption: string | null;
}

type ProcessStatus =
  | "auto_approved"
  | "pending_review"
  | "rejected"
  | "failed"
  | "duplicate_reused";

interface ProcessResult {
  status: ProcessStatus;
  confidence: number | null;
  aiCalls: number;
}

export interface SilverRunResult {
  totalProcessed: number;
  autoApproved: number;
  pendingReview: number;
  rejected: number;
  failed: number;
  duplicatesReused: number;
  aiCallsMade: number;
  avgConfidence: number | null;
}

/**
 * Phase 2+3 — Silver / Gold Layer.
 *
 * Polls pending_events WHERE status = 'PENDING' AND ai_raw_response IS NULL
 * (rows the bronze fetcher deposited but the worker has not yet touched).
 *
 * For each row:
 *   1. Download the stable Supabase image URL.
 *   2. Generate a perceptual hash — reuse existing extraction on near-duplicates.
 *   3. Multi-tier OCR: Tesseract → Gemini Vision fallback for low-quality scans.
 *   4. Three-step Gemini chain: detect → classify → extract.
 *   5. Apply midnight-rollover logic to build TIMESTAMPTZ starts_at / ends_at.
 *   6. Score confidence from OCR quality + LLM self-report + data completeness.
 *   7. confidence ≥ 0.85 → auto-publish to events table (Gold layer).
 *      confidence <  0.85 → enrich the pending row and leave for human review.
 */
export class SilverWorker {
  async run(ingestionRunId: string): Promise<SilverRunResult> {
    const today = new Date();
    const todayString = today.toISOString().split("T")[0];

    let totalProcessed = 0;
    let autoApproved = 0;
    let pendingReview = 0;
    let rejected = 0;
    let failed = 0;
    let duplicatesReused = 0;
    let aiCallsMade = 0;
    const confidenceScores: number[] = [];

    logger.info(`[Silver] Starting. Threshold: ${CONFIDENCE_THRESHOLD}. Batch: ${BATCH_SIZE}.`);

    // Process until there are no unworked PENDING rows left.
    while (true) {
      const { data: batch, error } = await supabase
        .from("pending_events")
        .select("id, ig_post_url, image_url, club_name, city, source_username, raw_caption")
        .eq("status", "PENDING")
        .is("ai_raw_response", null)
        .order("created_at", { ascending: true })
        .limit(BATCH_SIZE);

      if (error) {
        logger.error(`[Silver] Failed to fetch batch: ${error.message}`);
        break;
      }
      if (!batch || batch.length === 0) break;

      for (const row of batch as PendingRow[]) {
        const result = await this.processRow(row, today, todayString);
        totalProcessed++;
        aiCallsMade += result.aiCalls;

        if (result.status === "auto_approved")    autoApproved++;
        else if (result.status === "pending_review") pendingReview++;
        else if (result.status === "rejected")    rejected++;
        else if (result.status === "failed")      failed++;
        else if (result.status === "duplicate_reused") duplicatesReused++;

        if (result.confidence !== null) confidenceScores.push(result.confidence);

        await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));
      }
    }

    const avgConfidence = confidenceScores.length > 0
      ? parseFloat(
          (confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length).toFixed(2)
        )
      : null;

    logger.info(
      `[Silver] Done — processed: ${totalProcessed}, auto-approved: ${autoApproved}, ` +
      `review: ${pendingReview}, rejected: ${rejected}, failed: ${failed}, ` +
      `reused: ${duplicatesReused}, AI calls: ${aiCallsMade}`
    );

    await supabase
      .from("ingestion_runs")
      .update({
        ended_at:          new Date().toISOString(),
        events_extracted:  autoApproved + pendingReview,
        ai_calls_made:     aiCallsMade,
        average_confidence: avgConfidence,
        status:            "completed",
      })
      .eq("id", ingestionRunId);

    return { totalProcessed, autoApproved, pendingReview, rejected, failed, duplicatesReused, aiCallsMade, avgConfidence };
  }

  // ── Per-row pipeline ──────────────────────────────────────────────────────

  private async processRow(
    row: PendingRow,
    today: Date,
    todayString: string
  ): Promise<ProcessResult> {
    try {
      // 1. Download image (already hosted in Supabase storage by bronze fetcher)
      const buffer = await this.fetchBuffer(row.image_url);
      if (!buffer) {
        await this.markFailed(row.id, "Image download failed");
        return { status: "failed", confidence: null, aiCalls: 0 };
      }

      // 2. Perceptual hash
      const imageHash = await generateImageHash(buffer);

      // 3. Near-duplicate check against already-processed records
      const duplicate = await this.findDuplicate(imageHash, row.id);
      if (duplicate) {
        await this.handleDuplicate(row, duplicate, imageHash);
        return { status: "duplicate_reused", confidence: duplicate.confidence_score, aiCalls: 0 };
      }

      // 4. Multi-tier OCR
      const { ocrText, ocrScore } = await this.runMultiTierOCR(buffer);

      // 5. Three-step Gemini chain  (up to 3 API calls)
      const aiResult = await chainedClassifier.classify(buffer, todayString);
      const aiCalls = 3;

      if (!aiResult || !aiResult.is_event) {
        await this.markRejected(row.id, imageHash, ocrText, aiResult);
        return { status: "rejected", confidence: aiResult ? 0.9 : 0.0, aiCalls };
      }

      // 6. Build & validate event list
      const rawEvents = this.buildEventList(aiResult);
      const validEvents = rawEvents.filter(ev => ev.event_date && validator.validateDate(ev.event_date, today));

      if (validEvents.length === 0) {
        await this.markFailed(row.id, "No valid dates extracted", imageHash, aiResult, ocrText);
        return { status: "failed", confidence: 0.2, aiCalls };
      }

      // 7. Confidence scoring
      const confidence = this.calculateConfidence({
        ocrScore,
        llmConfidence: aiResult.llm_confidence,
        imageType: aiResult.image_type,
        events: validEvents,
      });

      // 8. Route
      if (aiResult.image_type === "weekly_overview" && validEvents.length > 1) {
        await this.handleWeeklyOverview(row, validEvents, aiResult, imageHash, ocrText, confidence);
      } else {
        await this.routeSingleEvent(row, validEvents[0], aiResult, imageHash, ocrText, confidence);
      }

      return {
        status: confidence >= CONFIDENCE_THRESHOLD ? "auto_approved" : "pending_review",
        confidence,
        aiCalls,
      };
    } catch (error) {
      logger.error(`[Silver] Unhandled error for ${row.ig_post_url}: ${error}`);
      await this.markFailed(row.id, String(error));
      return { status: "failed", confidence: null, aiCalls: 0 };
    }
  }

  // ── Image ─────────────────────────────────────────────────────────────────

  private async fetchBuffer(url: string): Promise<Buffer | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.length > 5000 ? buf : null;
    } catch (err) {
      logger.warn(`[Silver] Image fetch failed (${url}): ${err}`);
      return null;
    }
  }

  // ── OCR ───────────────────────────────────────────────────────────────────

  private async runMultiTierOCR(
    buffer: Buffer
  ): Promise<{ ocrText: string; ocrScore: number }> {
    // Pre-process with sharp when available: grayscale + auto-normalise contrast + sharpen
    let processedBuffer = buffer;
    try {
      const sharpMod = await import("sharp").catch(() => null);
      if (sharpMod) {
        processedBuffer = await sharpMod.default(buffer)
          .grayscale()
          .normalise()
          .sharpen({ sigma: 1.5 })
          .toBuffer();
      }
    } catch { /* sharp unavailable — proceed with raw buffer */ }

    let ocrText = await imageService.runOCR(processedBuffer);
    const wordCount = ocrText.trim().split(/\s+/).filter(Boolean).length;

    const nightlifeTerms = ["dj", "lineup", "doors", "party", "set", "live", "b2b", "presents"];
    const hasTerms = nightlifeTerms.some(k => ocrText.toLowerCase().includes(k));

    const ocrScore =
      wordCount > 15 && hasTerms ? 0.9
      : wordCount > 8              ? 0.6
      : wordCount > 3              ? 0.3
      :                              0.1;

    // If Tesseract yields garbage, ask Gemini Vision for raw text extraction
    if (ocrScore < 0.3 && ocrText.trim().length < 20) {
      logger.debug("[Silver] OCR quality low — requesting Gemini text extraction");
      const geminiText = await this.geminiOCRFallback(buffer);
      if (geminiText && geminiText.length > ocrText.length) {
        ocrText = geminiText;
      }
    }

    return { ocrText, ocrScore };
  }

  private async geminiOCRFallback(buffer: Buffer): Promise<string | null> {
    try {
      const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      const res = await fetch(`${url}?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Extract and return ALL text visible in this image. Return only the text, nothing else." },
              { inlineData: { mimeType: "image/jpeg", data: buffer.toString("base64") } },
            ],
          }],
        }),
      });

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    } catch {
      return null;
    }
  }

  // ── Event list helpers ────────────────────────────────────────────────────

  private buildEventList(result: ChainedExtractionResult): ExtractedEvent[] {
    if (result.image_type === "weekly_overview" && result.events?.length) {
      return result.events.map(ev => ({
        event_name:     ev.event_name     || "Special Event",
        djs:            ev.djs            || [],
        event_date:     ev.event_date     || "",
        starts_at_time: ev.starts_at_time ?? null,
        ends_at_time:   ev.ends_at_time   ?? null,
      }));
    }
    return [{
      event_name:     result.event_name     || "Special Event",
      djs:            result.djs            || [],
      event_date:     result.event_date     || "",
      starts_at_time: result.starts_at_time ?? null,
      ends_at_time:   result.ends_at_time   ?? null,
    }];
  }

  /**
   * Midnight rollover: Manila nightlife uses a "business night" model.
   * A party on "Saturday" with doors at 11 PM that runs until 4 AM on Sunday
   * is a SATURDAY event.  event_date is already set to the Saturday.
   *
   * Rule: if a time is between 00:00 and 05:59, it belongs to the next
   * calendar day relative to event_date.
   */
  private buildTimestamps(
    eventDate: string,
    startsAtTime: string | null,
    endsAtTime: string | null
  ): { starts_at: string | null; ends_at: string | null } {
    if (!startsAtTime) return { starts_at: null, ends_at: null };

    const applyRollover = (date: Date, timeStr: string): Date => {
      const [h] = timeStr.split(":").map(Number);
      const dt = new Date(`${eventDate}T${timeStr}:00`);
      if (h >= 0 && h < 6) dt.setDate(dt.getDate() + 1); // post-midnight = next calendar day
      return dt;
    };

    const startsAt = applyRollover(new Date(), startsAtTime);
    let endsAt: Date | null = null;

    if (endsAtTime) {
      endsAt = applyRollover(new Date(), endsAtTime);
      if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1); // safety: ends must follow start
    }

    return {
      starts_at: startsAt.toISOString(),
      ends_at:   endsAt?.toISOString() ?? null,
    };
  }

  // ── Confidence scoring ────────────────────────────────────────────────────

  private calculateConfidence(params: {
    ocrScore: number;
    llmConfidence: number;
    imageType: string;
    events: ExtractedEvent[];
  }): number {
    const { ocrScore, llmConfidence, imageType, events } = params;

    const ev = events[0];
    let completeness = 0;
    if (ev.event_name && ev.event_name !== "Special Event") completeness += 0.3;
    if (ev.event_date && /^\d{4}-\d{2}-\d{2}$/.test(ev.event_date)) completeness += 0.4;
    if (ev.djs?.length > 0)                                          completeness += 0.3;

    const typeBonus = imageType === "dedicated_poster" ? 0.05 : 0;

    // OCR 20% + LLM confidence 40% + data completeness 40% + type bonus
    return Math.min(1.0, parseFloat(
      (ocrScore * 0.2 + llmConfidence * 0.4 + completeness * 0.4 + typeBonus).toFixed(2)
    ));
  }

  // ── Routing ───────────────────────────────────────────────────────────────

  private async routeSingleEvent(
    row: PendingRow,
    event: ExtractedEvent,
    aiResult: ChainedExtractionResult,
    imageHash: string,
    ocrText: string,
    confidence: number
  ): Promise<void> {
    const { starts_at, ends_at } = this.buildTimestamps(
      event.event_date, event.starts_at_time, event.ends_at_time
    );

    const enrichment = {
      event_name:       event.event_name,
      dj_name:          event.djs.join(", "),
      djs:              event.djs,
      event_date:       event.event_date,
      starts_at,
      ends_at,
      image_hash:       imageHash,
      ocr_text:         ocrText,
      ai_raw_response:  aiResult as unknown as Record<string, unknown>,
      parse_method:     "chained_gemini_v2",
      confidence_score: confidence,
    };

    if (confidence >= CONFIDENCE_THRESHOLD) {
      await this.publishToEvents(row, event, imageHash, confidence, starts_at, ends_at);
      await supabase
        .from("pending_events")
        .update({ ...enrichment, status: "APPROVED" })
        .eq("id", row.id);
      logger.info(`[Silver] Auto-approved: "${event.event_name}" on ${event.event_date} (${confidence})`);
    } else {
      await supabase
        .from("pending_events")
        .update(enrichment)
        .eq("id", row.id);
      logger.info(`[Silver] Queued for review: "${event.event_name}" on ${event.event_date} (${confidence})`);
    }
  }

  private async handleWeeklyOverview(
    row: PendingRow,
    events: ExtractedEvent[],
    aiResult: ChainedExtractionResult,
    imageHash: string,
    ocrText: string,
    confidence: number
  ): Promise<void> {
    // Mark the parent row as processed (split into children)
    await supabase
      .from("pending_events")
      .update({
        image_hash:      imageHash,
        ocr_text:        ocrText,
        ai_raw_response: aiResult as unknown as Record<string, unknown>,
        parse_method:    "chained_gemini_v2",
        confidence_score: confidence,
        status:          "APPROVED",
        scraper_notes:   `Split into ${events.length} per-event rows`,
      })
      .eq("id", row.id);

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const childUrl = `${row.ig_post_url}#event-${i}-${event.event_date}`;

      // Idempotency: skip if this child already exists
      const { data: exists } = await supabase
        .from("pending_events")
        .select("id")
        .eq("ig_post_url", childUrl)
        .maybeSingle();
      if (exists) continue;

      const { starts_at, ends_at } = this.buildTimestamps(
        event.event_date, event.starts_at_time, event.ends_at_time
      );

      const childRow = {
        ig_post_url:     childUrl,
        event_name:      event.event_name,
        dj_name:         event.djs.join(", "),
        djs:             event.djs,
        event_date:      event.event_date,
        starts_at,
        ends_at,
        club_name:       row.club_name,
        city:            row.city,
        source_username: row.source_username,
        image_url:       row.image_url,
        image_hash:      imageHash,
        ai_raw_response: { extracted_from_weekly: true, parent_post_url: row.ig_post_url },
        confidence_score: confidence,
        status:          confidence >= CONFIDENCE_THRESHOLD ? "APPROVED" : "PENDING",
        source:          "scraper",
        parse_method:    "chained_gemini_v2",
      };

      const { error } = await supabase.from("pending_events").insert(childRow);
      if (error) {
        logger.error(`[Silver] Failed to insert weekly overview child: ${error.message}`);
        continue;
      }

      if (confidence >= CONFIDENCE_THRESHOLD) {
        await this.publishToEvents(
          { ...row, ig_post_url: childUrl },
          event,
          imageHash,
          confidence,
          starts_at,
          ends_at
        );
      }
    }
  }

  // ── Gold: publish to events table ─────────────────────────────────────────

  private async publishToEvents(
    row: PendingRow,
    event: ExtractedEvent,
    imageHash: string,
    confidence: number,
    starts_at: string | null,
    ends_at: string | null
  ): Promise<void> {
    await publishEvent({
      event_name:      event.event_name,
      club_name:       row.club_name,
      city:            row.city,
      event_date:      event.event_date,
      djs:             event.djs,
      dj_name:         event.djs.join(", "),
      image_url:       row.image_url,
      ig_post_url:     row.ig_post_url,
      starts_at,
      ends_at,
      confidence_score: confidence,
      image_hash:       imageHash,
      source_username:  row.source_username ?? undefined,
      source_platform:  "instagram",
      source_priority:  10,
    });
  }

  // ── Duplicate detection ────────────────────────────────────────────────────

  private async findDuplicate(
    imageHash: string,
    excludeId: string
  ): Promise<{ id: string; confidence_score: number; event_name: string; event_date: string; djs: string[] } | null> {
    const { data } = await supabase
      .from("pending_events")
      .select("id, image_hash, confidence_score, event_name, event_date, djs")
      .not("image_hash", "is", null)
      .neq("id", excludeId)
      .not("ai_raw_response", "is", null)
      .limit(500);

    if (!data) return null;

    for (const row of data) {
      if (row.image_hash && isNearDuplicate(imageHash, row.image_hash)) {
        return row;
      }
    }
    return null;
  }

  private async handleDuplicate(
    row: PendingRow,
    original: { id: string; confidence_score: number; event_name: string; event_date: string; djs: string[] },
    imageHash: string
  ): Promise<void> {
    logger.info(`[Silver] Near-duplicate of ${original.id} — reusing data for ${row.ig_post_url}`);
    await supabase
      .from("pending_events")
      .update({
        event_name:      original.event_name,
        event_date:      original.event_date,
        djs:             original.djs,
        dj_name:         original.djs?.join(", ") || "",
        image_hash:      imageHash,
        confidence_score: original.confidence_score,
        parse_method:    "phash_reuse",
        scraper_notes:   `Near-duplicate of pending_event ${original.id}`,
        ai_raw_response: { reused_from: original.id },
        status:          original.confidence_score >= CONFIDENCE_THRESHOLD ? "APPROVED" : "PENDING",
      })
      .eq("id", row.id);
  }

  // ── Terminal state writers ─────────────────────────────────────────────────

  private async markRejected(
    id: string,
    imageHash: string,
    ocrText: string,
    aiResult: ChainedExtractionResult | null
  ): Promise<void> {
    await supabase
      .from("pending_events")
      .update({
        status:          "REJECTED",
        image_hash:      imageHash,
        ocr_text:        ocrText,
        ai_raw_response: (aiResult as unknown as Record<string, unknown>) ?? { error: "no_event_detected" },
        confidence_score: aiResult ? 0.9 : 0.0,
        parse_method:    "chained_gemini_v2",
      })
      .eq("id", id);
  }

  private async markFailed(
    id: string,
    reason: string,
    imageHash?: string,
    aiResult?: ChainedExtractionResult | null,
    ocrText?: string
  ): Promise<void> {
    await supabase
      .from("pending_events")
      .update({
        status:        "EXTRACTION_FAILED",
        scraper_notes: reason,
        ...(imageHash && { image_hash: imageHash }),
        ...(aiResult  && { ai_raw_response: aiResult as unknown as Record<string, unknown> }),
        ...(ocrText   && { ocr_text: ocrText }),
      })
      .eq("id", id);
  }
}

export const silverWorker = new SilverWorker();
