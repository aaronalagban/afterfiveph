import { instagramClient } from "./instagram.client";
import { imageService } from "./image.service";
import { venueService } from "../venues/venues.service";
import { supabase } from "../../lib/supabase";
import { logger } from "../../lib/logger";
import { Venue } from "../venues/types";

/** How far back to look when evaluating posts (venues post early). */
const ROLLING_WINDOW_DAYS = Number(process.env.SCRAPER_WINDOW_DAYS) || 21;

/** How many posts to fetch per account from Apify. */
const POSTS_PER_ACCOUNT = Number(process.env.SCRAPER_RESULTS_LIMIT) || 20;

export interface BronzeRunResult {
  postsScanned: number;
  newInserts: number;
  duplicatesSkipped: number;
  uploadErrors: number;
}

/**
 * Phase 1 — Bronze Layer.
 *
 * This fetcher is intentionally "dumb":
 *   - Evaluates a 21-day rolling window (venues post early).
 *   - Downloads and re-hosts every flyer to Supabase storage so the silver
 *     worker always has a valid, stable URL regardless of Instagram link expiry.
 *   - Writes one row per Instagram post into pending_events.
 *   - Uses UPSERT semantics: if the post already exists, only last_seen_at is
 *     touched so that in-progress AI enrichment is never overwritten.
 *   - Zero LLM / OCR calls.
 */
export class BronzeFetcher {
  async run(): Promise<BronzeRunResult> {
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setDate(now.getDate() - ROLLING_WINDOW_DAYS);

    // ── Load venues ──────────────────────────────────────────────────────────
    const venues = await venueService.getActiveVenues();
    if (venues.length === 0) {
      logger.warn("[Bronze] No active venues — aborting.");
      return { postsScanned: 0, newInserts: 0, duplicatesSkipped: 0, uploadErrors: 0 };
    }

    const venueByHandle = new Map<string, Venue>(venues.map(v => [v.ig_handle, v]));
    const igHandles = venues.map(v => v.ig_handle);

    logger.info(
      `[Bronze] Scanning ${igHandles.length} venues. Rolling window: ${ROLLING_WINDOW_DAYS} days.`
    );

    // ── Fetch & filter posts ─────────────────────────────────────────────────
    const allPosts = await instagramClient.fetchPosts(igHandles, POSTS_PER_ACCOUNT);
    const posts = allPosts.filter(p => new Date(p.timestamp) >= windowStart);

    logger.info(
      `[Bronze] ${allPosts.length} posts fetched. ${posts.length} within window.`
    );

    let newInserts = 0;
    let duplicatesSkipped = 0;
    let uploadErrors = 0;

    for (const post of posts) {
      const username = post.ownerUsername || "unknown";
      const venue = venueByHandle.get(username);

      // ── Idempotency check ────────────────────────────────────────────────
      const { data: existing } = await supabase
        .from("pending_events")
        .select("id")
        .eq("ig_post_url", post.url)
        .maybeSingle();

      if (existing) {
        // Post seen before — just refresh the freshness timestamp.
        await supabase
          .from("pending_events")
          .update({ last_seen_at: now.toISOString() })
          .eq("id", existing.id);
        duplicatesSkipped++;
        continue;
      }

      // ── Download & re-host all slides ─────────────────────────────────────
      const imageSources = post.childPosts?.length ? post.childPosts : [post];
      const uploadedUrls: string[] = [];

      for (const source of imageSources) {
        const buffer = await imageService.getImageBuffer(source);
        if (!buffer) continue;

        try {
          const url = await imageService.uploadFlyer(buffer, `bronze-${username}`);
          uploadedUrls.push(url);
        } catch (err) {
          logger.warn(`[Bronze] Upload failed for a slide in ${post.url}: ${err}`);
          uploadErrors++;
          // Fall back to the original (potentially expiring) URL
          if (source.displayUrl) uploadedUrls.push(source.displayUrl);
        }
      }

      if (uploadedUrls.length === 0) {
        logger.warn(`[Bronze] No usable images for ${post.url} — skipping.`);
        continue;
      }

      // ── Persist raw row ──────────────────────────────────────────────────
      const rawPayload = {
        ownerUsername:    post.ownerUsername,
        timestamp:        post.timestamp,
        type:             post.type,
        originalDisplayUrl: post.displayUrl ?? null,
        originalVideoUrl:   post.videoUrl   ?? null,
        slideCount:         imageSources.length,
      };

      const { error } = await supabase.from("pending_events").insert({
        ig_post_url:     post.url,
        club_name:       venue?.name ?? username,
        city:            venue?.city ?? "Makati",
        source_username: username,
        image_url:       uploadedUrls[0],
        carousel_images: uploadedUrls,
        raw_payload:     rawPayload,
        raw_caption:     post.caption ?? null,
        last_seen_at:    now.toISOString(),
        status:          "PENDING",
        source:          "scraper",
      });

      if (error) {
        logger.error(`[Bronze] Insert failed for ${post.url}: ${error.message}`);
      } else {
        newInserts++;
        logger.debug(`[Bronze] Stored ${post.url} (${uploadedUrls.length} slide(s))`);
      }
    }

    logger.info(
      `[Bronze] Complete — scanned: ${posts.length}, new: ${newInserts}, ` +
      `duplicates: ${duplicatesSkipped}, upload errors: ${uploadErrors}`
    );

    return { postsScanned: posts.length, newInserts, duplicatesSkipped, uploadErrors };
  }
}

export const bronzeFetcher = new BronzeFetcher();
