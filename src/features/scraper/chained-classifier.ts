import { logger } from "../../lib/logger";
import { retry } from "../../lib/retry";

export type ImageType =
  | "dedicated_poster"
  | "weekly_overview"
  | "artist_promo"
  | "not_event";

export interface ExtractedEvent {
  event_name: string;
  djs: string[];
  event_date: string;
  /** 24-hour "HH:MM" — null when not printed on the flyer */
  starts_at_time: string | null;
  /** 24-hour "HH:MM" — null when not printed; caller handles midnight rollover */
  ends_at_time: string | null;
}

export interface ChainedExtractionResult {
  image_type: ImageType;
  is_event: boolean;
  /** Top-level fields are populated for dedicated_poster; empty for weekly_overview */
  event_name: string;
  djs: string[];
  event_date: string;
  starts_at_time: string | null;
  ends_at_time: string | null;
  /** Populated for weekly_overview — one entry per distinct business date */
  events: ExtractedEvent[] | null;
  /** 0.0–1.0 self-reported by the model on the extraction step */
  llm_confidence: number;
}

export class ChainedClassifier {
  private readonly model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  private readonly apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

  /**
   * Three-step chain:
   *   Step 1 — Detection:     is there an event at all?
   *   Step 2 — Classification: what kind of post is this?
   *   Step 3 — Extraction:    pull structured JSON from the flyer.
   */
  async classify(
    buffer: Buffer,
    todayString: string
  ): Promise<ChainedExtractionResult | null> {
    // ── Step 1: Detection ────────────────────────────────────────────────────
    const isEvent = await this.detectEvent(buffer);
    if (!isEvent) {
      return this.buildNonEventResult("not_event");
    }

    // ── Step 2: Classification ───────────────────────────────────────────────
    const imageType = await this.classifyType(buffer);

    if (imageType === "artist_promo" || imageType === "not_event") {
      return this.buildNonEventResult(imageType);
    }

    // ── Step 3: Extraction ───────────────────────────────────────────────────
    return this.extractEventData(buffer, imageType, todayString);
  }

  // ── Step 1 ────────────────────────────────────────────────────────────────

  private async detectEvent(buffer: Buffer): Promise<boolean> {
    const prompt = `Analyze this image. Does it contain a nightlife event announcement — flyer, DJ lineup, schedule, or venue event post?
Return ONLY valid JSON with no markdown:
{"is_event": true, "confidence": 0.95}`;

    const raw = await this.call(prompt, buffer);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      return parsed.is_event === true && (parsed.confidence ?? 0) > 0.5;
    } catch {
      return false;
    }
  }

  // ── Step 2 ────────────────────────────────────────────────────────────────

  private async classifyType(buffer: Buffer): Promise<ImageType> {
    const prompt = `Classify this nightlife image into exactly one of:
- "dedicated_poster"  — a flyer for ONE specific event on ONE specific night
- "weekly_overview"   — a schedule listing MULTIPLE events across different dates
- "artist_promo"      — promoting an individual DJ/artist (no specific event date)
- "not_event"         — not a nightlife event post

Return ONLY valid JSON with no markdown:
{"image_type": "dedicated_poster", "confidence": 0.92}`;

    const raw = await this.call(prompt, buffer);
    if (!raw) return "not_event";
    try {
      const parsed = JSON.parse(raw);
      return (parsed.image_type as ImageType) ?? "not_event";
    } catch {
      return "not_event";
    }
  }

  // ── Step 3 ────────────────────────────────────────────────────────────────

  private async extractEventData(
    buffer: Buffer,
    imageType: "dedicated_poster" | "weekly_overview",
    todayString: string
  ): Promise<ChainedExtractionResult | null> {
    const prompt = `Extract structured event data from this Manila nightlife flyer.

Today: ${todayString}. All dates → YYYY-MM-DD. Year must be current or next year.
Never return dates before today or more than 60 days ahead.

MIDNIGHT ROLLOVER RULE (critical for Manila nightlife):
A party advertised for "Saturday" with doors at 11 PM is a SATURDAY event even if it closes at 4 AM Sunday.
- event_date = the business night the party is advertised for (the Saturday, not the Sunday).
- starts_at_time = 24-hour HH:MM when doors open/event starts, e.g. "23:00".
- ends_at_time   = 24-hour HH:MM when it ends; if after midnight write "03:00" — the caller adds +1 day.
- If times are not visible on the flyer, set both to null.

DJ extraction rules:
- Extract full stage names. "@mentions" are DJ handles — strip the "@" symbol.
- Separate multiple DJs into the array. Do not concatenate them.

image_type is "${imageType}":
${imageType === "weekly_overview"
  ? '- Populate "events" array (one entry per distinct business date). Leave top-level event_name/event_date/djs empty.'
  : '- Populate top-level event_name/event_date/djs. Set "events" to null.'}

Return ONLY valid JSON — no markdown, no backticks, no explanation:
{
  "image_type": "${imageType}",
  "is_event": true,
  "event_name": "",
  "djs": [],
  "event_date": "",
  "starts_at_time": null,
  "ends_at_time": null,
  "events": null,
  "llm_confidence": 0.85
}`;

    const raw = await this.call(prompt, buffer);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw.trim().replace(/```json|```/g, ""));
      return {
        image_type:     parsed.image_type     ?? imageType,
        is_event:       true,
        event_name:     parsed.event_name     ?? "",
        djs:            Array.isArray(parsed.djs) ? parsed.djs : [],
        event_date:     parsed.event_date     ?? "",
        starts_at_time: parsed.starts_at_time ?? null,
        ends_at_time:   parsed.ends_at_time   ?? null,
        events:         Array.isArray(parsed.events) ? parsed.events : null,
        llm_confidence: typeof parsed.llm_confidence === "number"
          ? Math.min(1, Math.max(0, parsed.llm_confidence))
          : 0.5,
      };
    } catch (e) {
      logger.error("[ChainedClassifier] Failed to parse extraction JSON:", raw);
      return null;
    }
  }

  // ── Shared Gemini call ────────────────────────────────────────────────────

  private async call(prompt: string, buffer: Buffer): Promise<string | null> {
    return retry(async () => {
      const res = await fetch(`${this.apiUrl}?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/jpeg", data: buffer.toString("base64") } },
            ],
          }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });

      if (res.status === 429) throw new Error("Gemini 429 — rate limited");

      const data = await res.json();
      const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        logger.debug("[ChainedClassifier] Empty Gemini response", data);
        return null;
      }
      return text;
    }, 3, 5000);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private buildNonEventResult(imageType: ImageType): ChainedExtractionResult {
    return {
      image_type:     imageType,
      is_event:       imageType !== "not_event",
      event_name:     "",
      djs:            [],
      event_date:     "",
      starts_at_time: null,
      ends_at_time:   null,
      events:         null,
      llm_confidence: 0.9,
    };
  }
}

export const chainedClassifier = new ChainedClassifier();
