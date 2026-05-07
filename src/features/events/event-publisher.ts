import { SupabaseClient } from "@supabase/supabase-js";
import { supabase as defaultClient } from "../../lib/supabase";
import { logger } from "../../lib/logger";

export interface PublishEventInput {
  event_name:       string | null;
  club_name:        string;
  city:             string;
  event_date:       string;
  djs:              string[];
  dj_name:          string;
  image_url:        string | null;
  ig_post_url:      string;
  starts_at:        string | null;
  ends_at:          string | null;
  confidence_score?: number | null;
  image_hash?:       string | null;
  source_username?:  string | null;
  source_platform?:  string;
  source_priority?:  number;
}

/**
 * Gold-layer publisher.
 *
 * Atomically:
 *   1. Upserts the venue by (name, city)           → resolves venue_id
 *   2. Inserts the event row                        → resolves event_id
 *      On ig_post_url conflict: leaves existing row untouched, just reads its id.
 *   3. Upserts each DJ name into artists            → resolves artist_id per DJ
 *   4. Links artists to the event via event_artists
 *
 * Accepts an optional supabase client so API routes can pass their own
 * service-role client without re-creating it.
 *
 * Returns the event id on success, null on failure.
 */
export async function publishEvent(
  input: PublishEventInput,
  client: SupabaseClient = defaultClient
): Promise<number | null> {
  // ── 1. Venue upsert ────────────────────────────────────────────────────────
  const { data: venue, error: venueError } = await client
    .from("venues")
    .upsert(
      {
        name:      input.club_name,
        city:      input.city,
        timezone:  "Asia/Manila",
        is_active: true,
      },
      { onConflict: "name,city" }
    )
    .select("id")
    .single();

  if (venueError || !venue) {
    logger.error(`[Publisher] Venue upsert failed: ${venueError?.message}`);
    return null;
  }

  // ── 2. Event insert (conflict-safe) ────────────────────────────────────────
  const eventPayload = {
    event_name:      input.event_name ?? "Special Event",
    dj_name:         input.dj_name,
    club_name:       input.club_name,
    city:            input.city,
    event_date:      input.event_date,
    starts_at:       input.starts_at,
    ends_at:         input.ends_at,
    djs:             input.djs,
    image_url:       input.image_url ?? "",
    ig_post_url:     input.ig_post_url,
    venue_id:        venue.id,
    confidence_score: input.confidence_score  ?? null,
    image_hash:       input.image_hash        ?? null,
    source_username:  input.source_username   ?? null,
    source_platform:  input.source_platform   ?? "instagram",
    source_priority:  input.source_priority   ?? 10,
  };

  const { data: insertedEvent, error: insertError } = await client
    .from("events")
    .insert(eventPayload)
    .select("id")
    .single();

  let eventId: number;

  if (insertError) {
    if (insertError.code === "23505") {
      // ig_post_url already exists — the event was previously approved or auto-published.
      // Don't overwrite it; just grab the id so we can still link artists.
      const { data: existing, error: fetchError } = await client
        .from("events")
        .select("id")
        .eq("ig_post_url", input.ig_post_url)
        .single();

      if (fetchError || !existing) {
        logger.error(`[Publisher] Could not resolve existing event for ${input.ig_post_url}`);
        return null;
      }
      eventId = existing.id;
    } else {
      logger.error(`[Publisher] Event insert failed: ${insertError.message}`);
      return null;
    }
  } else {
    eventId = insertedEvent.id;
  }

  // ── 3+4. Artist upserts + junction links ──────────────────────────────────
  const uniqueDJs = [...new Set(input.djs.map(d => d.trim()).filter(Boolean))];

  for (const djName of uniqueDJs) {
    const { data: artist, error: artistError } = await client
      .from("artists")
      .upsert({ name: djName }, { onConflict: "name" })
      .select("id")
      .single();

    if (artistError || !artist) {
      logger.warn(`[Publisher] Artist upsert failed for "${djName}": ${artistError?.message}`);
      continue;
    }

    const { error: linkError } = await client
      .from("event_artists")
      .insert({ event_id: eventId, artist_id: artist.id });

    // 23505 = already linked (safe to ignore on re-publish)
    if (linkError && linkError.code !== "23505") {
      logger.warn(`[Publisher] event_artists insert failed: ${linkError.message}`);
    }
  }

  logger.info(
    `[Publisher] Published event ${eventId} — "${input.event_name}" on ${input.event_date} ` +
    `(${uniqueDJs.length} artist(s) linked)`
  );

  return eventId;
}
