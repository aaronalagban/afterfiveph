-- =============================================================================
-- NORMALIZATION MIGRATION
-- Adds artists / event_artists tables, enriches venues,
-- and backfills all relationships from existing flat data.
--
-- Depends on: 20260508000000_medallion_architecture.sql
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — Enrich venues
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS address        text,
  ADD COLUMN IF NOT EXISTS google_maps_url text,
  ADD COLUMN IF NOT EXISTS latitude       numeric(9, 6),
  ADD COLUMN IF NOT EXISTS longitude      numeric(9, 6);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — Artists table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS artists (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  ig_handle  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artists_name_unique UNIQUE (name)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — Event–Artist junction table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_artists (
  event_id  bigint NOT NULL REFERENCES events(id)  ON DELETE CASCADE,
  artist_id uuid   NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  CONSTRAINT event_artists_pkey PRIMARY KEY (event_id, artist_id)
);

CREATE INDEX IF NOT EXISTS idx_event_artists_artist_id
  ON event_artists (artist_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4 — Backfill artists from existing events data
--
-- Sources (in priority order):
--   events.djs   — text[] set by the scraper; most reliable
--   events.dj_name — legacy comma-separated fallback
--
-- Exclusions: empty strings, 'Various Artists' placeholder.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO artists (name)
SELECT DISTINCT trim(raw_name) AS name
FROM (
  -- Source 1: djs array
  SELECT unnest(djs) AS raw_name
  FROM   events
  WHERE  djs IS NOT NULL
    AND  array_length(djs, 1) > 0

  UNION

  -- Source 2: dj_name text column (may be comma-separated)
  SELECT trim(unnest(string_to_array(dj_name, ','))) AS raw_name
  FROM   events
  WHERE  dj_name IS NOT NULL
    AND  trim(dj_name) <> ''
) all_names
WHERE trim(raw_name) <> ''
  AND trim(raw_name) NOT ILIKE 'various%'
  AND length(trim(raw_name)) > 1
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5 — Populate event_artists from events.djs
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO event_artists (event_id, artist_id)
SELECT DISTINCT e.id, a.id
FROM   events e,
       LATERAL unnest(e.djs) AS dj_name
JOIN   artists a
  ON   LOWER(trim(a.name)) = LOWER(trim(dj_name))
WHERE  e.djs IS NOT NULL
  AND  array_length(e.djs, 1) > 0
ON CONFLICT (event_id, artist_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6 — Verify backfill (informational — does not affect data)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_artists       integer;
  v_links         integer;
  v_events_linked integer;
BEGIN
  SELECT COUNT(*) INTO v_artists FROM artists;
  SELECT COUNT(*) INTO v_links   FROM event_artists;
  SELECT COUNT(DISTINCT event_id) INTO v_events_linked FROM event_artists;

  RAISE NOTICE 'Backfill complete — artists: %, event_artist links: %, events with artists: %',
    v_artists, v_links, v_events_linked;
END $$;

COMMIT;
