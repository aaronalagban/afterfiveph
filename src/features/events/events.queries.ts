import { supabase } from "../../lib/supabase";

/**
 * Supabase PostgREST select string that returns a fully-joined event:
 *
 *   event.venue   — the normalised Venue row
 *   event.artists — flattened list of Artist rows via the junction table
 *
 * The junction table (event_artists) is transparent to callers: PostgREST
 * flattens it so consumers receive `artists: Artist[]` directly.
 */
const EVENT_SELECT = `
  *,
  venue:venues (
    id,
    name,
    city,
    ig_handle,
    address,
    google_maps_url,
    latitude,
    longitude
  ),
  artists:event_artists (
    artist:artists (
      id,
      name,
      ig_handle
    )
  )
` as const;

// ── Typed response shapes ─────────────────────────────────────────────────────

export interface ArtistRow {
  id: string;
  name: string;
  ig_handle: string | null;
}

export interface VenueRow {
  id: string;
  name: string;
  city: string;
  ig_handle: string | null;
  address: string | null;
  google_maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface EventWithRelations {
  id: number;
  event_name: string | null;
  event_date: string;
  image_url: string;
  ig_post_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  // Legacy flat columns — kept for backward compat, prefer relations below
  club_name: string;
  city: string;
  dj_name: string;
  djs: string[];
  // Normalised relations
  venue: VenueRow | null;
  artists: { artist: ArtistRow }[];
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** All upcoming events (today onward), ordered by date ascending. */
export async function fetchUpcomingEvents(): Promise<EventWithRelations[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .gte("event_date", today)
    .order("event_date", { ascending: true });

  if (error) throw new Error(`fetchUpcomingEvents: ${error.message}`);
  return (data ?? []) as EventWithRelations[];
}

/** Single event by id, with all relations. */
export async function fetchEventById(id: number): Promise<EventWithRelations | null> {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`fetchEventById: ${error.message}`);
  return data as EventWithRelations | null;
}

/** Events for a specific venue, upcoming only. */
export async function fetchEventsByVenue(venueId: string): Promise<EventWithRelations[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("venue_id", venueId)
    .gte("event_date", today)
    .order("event_date", { ascending: true });

  if (error) throw new Error(`fetchEventsByVenue: ${error.message}`);
  return (data ?? []) as EventWithRelations[];
}

/**
 * Helper: extract a flat artist list from the nested junction shape.
 *
 * Usage:
 *   const events = await fetchUpcomingEvents();
 *   const artists = flatArtists(events[0]);  // → ArtistRow[]
 */
export function flatArtists(event: EventWithRelations): ArtistRow[] {
  return event.artists.map(link => link.artist).filter(Boolean);
}
