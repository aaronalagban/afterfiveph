-- =============================================================================
-- MEDALLION ARCHITECTURE MIGRATION
-- Bronze / Silver / Gold ingestion pipeline for AfterFivePH
--
-- Written against the verified schema:
--   events        — id bigint identity, ig_post_url already UNIQUE
--   pending_events — id uuid, event_name NOT NULL, event_date NOT NULL, no UNIQUE on ig_post_url
--   communities   — untouched
--
-- Safe to re-run: every destructive step is guarded by IF EXISTS /
-- IF NOT EXISTS / DO $$ … EXCEPTION … END $$ blocks.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — Staging / Bronze Layer  (pending_events)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1.1  Create status ENUM (idempotent)
DO $$ BEGIN
  CREATE TYPE pending_event_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'EXTRACTION_FAILED'
  );
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Type pending_event_status already exists — skipping.';
END $$;

-- 1.2  Normalise any existing lowercase values → UPPERCASE before the type swap
UPDATE pending_events
SET status = UPPER(status)
WHERE status IS NOT NULL
  AND status NOT IN ('PENDING', 'APPROVED', 'REJECTED', 'EXTRACTION_FAILED');

-- Null-safe default
UPDATE pending_events
SET status = 'PENDING'
WHERE status IS NULL
   OR status NOT IN ('PENDING', 'APPROVED', 'REJECTED', 'EXTRACTION_FAILED');

-- 1.3  Convert status column: text → enum  (in-place rewrite, no data lost)
--      Drop the old text default first — Postgres cannot auto-cast 'pending'::text
--      to the new enum type and will error if the default is left in place.
ALTER TABLE pending_events ALTER COLUMN status DROP DEFAULT;

ALTER TABLE pending_events
  ALTER COLUMN status TYPE pending_event_status
  USING status::pending_event_status;

ALTER TABLE pending_events
  ALTER COLUMN status SET DEFAULT 'PENDING'::pending_event_status,
  ALTER COLUMN status SET NOT NULL;

-- 1.4  Relax NOT NULL constraints that the Bronze fetcher cannot satisfy
--      (event_name and event_date are unknown until the Silver worker runs)
ALTER TABLE pending_events
  ALTER COLUMN event_name DROP NOT NULL,
  ALTER COLUMN event_date DROP NOT NULL;

-- 1.5  Deduplicate ig_post_url before adding the UNIQUE constraint.
--      Keep: APPROVED rows first, then most-recently created.
DELETE FROM pending_events a
USING (
  SELECT
    ig_post_url,
    (
      SELECT id
      FROM   pending_events p
      WHERE  p.ig_post_url = sub.ig_post_url
      ORDER BY
        CASE WHEN p.status = 'APPROVED' THEN 0 ELSE 1 END,
        p.created_at DESC NULLS LAST
      LIMIT 1
    ) AS keep_id
  FROM (
    SELECT ig_post_url
    FROM   pending_events
    GROUP  BY ig_post_url
    HAVING COUNT(*) > 1
  ) sub
) dups
WHERE a.ig_post_url = dups.ig_post_url
  AND a.id          != dups.keep_id;

-- 1.6  Add UNIQUE constraint on ig_post_url (scraper idempotency key)
DO $$ BEGIN
  ALTER TABLE pending_events
    ADD CONSTRAINT pending_events_ig_post_url_unique UNIQUE (ig_post_url);
EXCEPTION WHEN duplicate_table THEN
  RAISE NOTICE 'Constraint pending_events_ig_post_url_unique already exists — skipping.';
END $$;

-- 1.7  Bronze raw-storage columns
ALTER TABLE pending_events
  ADD COLUMN IF NOT EXISTS raw_payload     jsonb,
  ADD COLUMN IF NOT EXISTS raw_caption     text,
  ADD COLUMN IF NOT EXISTS scraper_notes   text,
  ADD COLUMN IF NOT EXISTS source_username text,
  ADD COLUMN IF NOT EXISTS last_seen_at    timestamptz DEFAULT now();

-- 1.8  Silver intelligence columns
ALTER TABLE pending_events
  ADD COLUMN IF NOT EXISTS ocr_text         text,
  ADD COLUMN IF NOT EXISTS ai_raw_response  jsonb,
  ADD COLUMN IF NOT EXISTS parse_method     text,
  ADD COLUMN IF NOT EXISTS image_hash       text,
  ADD COLUMN IF NOT EXISTS confidence_score numeric(3, 2)
    CHECK (
      confidence_score IS NULL
      OR (confidence_score >= 0.0 AND confidence_score <= 1.0)
    );

-- 1.9  Time-domain columns (optional — null until Silver extracts them)
ALTER TABLE pending_events
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at   timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — Venues table
-- ─────────────────────────────────────────────────────────────────────────────

-- 2.1  Create venues table if it doesn't already exist.
--      ig_handle is nullable so venues seeded from events data (which have no
--      known IG handle) can be inserted without a placeholder.
CREATE TABLE IF NOT EXISTS venues (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  city       text        NOT NULL,
  ig_handle  text,
  timezone   text        NOT NULL DEFAULT 'Asia/Manila',
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venues_name_city_unique UNIQUE (name, city)
);

-- 2.2  If the table already existed without these columns, add them safely
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS timezone   text NOT NULL DEFAULT 'Asia/Manila',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- 2.3  If the table already existed without the (name, city) constraint, add it
DO $$ BEGIN
  ALTER TABLE venues ADD CONSTRAINT venues_name_city_unique UNIQUE (name, city);
EXCEPTION WHEN duplicate_table THEN
  RAISE NOTICE 'Constraint venues_name_city_unique already exists — skipping.';
END $$;

-- 2.4  Seed venues from unique (club_name, city) combos already in events.
--      ON CONFLICT DO NOTHING is safe to re-run.
INSERT INTO venues (id, name, city, timezone, is_active)
SELECT
  gen_random_uuid(),
  trim(club_name),
  trim(city),
  'Asia/Manila',
  true
FROM (
  SELECT DISTINCT trim(club_name) AS club_name, trim(city) AS city
  FROM   events
  WHERE  club_name IS NOT NULL
    AND  city      IS NOT NULL
    AND  trim(club_name) <> ''
    AND  trim(city)      <> ''
) deduped
ON CONFLICT (name, city) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — Events table: venue FK + Medallion metadata
-- ─────────────────────────────────────────────────────────────────────────────

-- 3.1  Add venue_id FK.
--      events.id is a bigint identity; events.ig_post_url already has its own
--      UNIQUE constraint from the original schema — do NOT re-add it.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE SET NULL;

-- 3.2  Backfill venue_id for all existing rows
UPDATE events e
SET    venue_id = v.id
FROM   venues v
WHERE  LOWER(trim(e.club_name)) = LOWER(v.name)
  AND  LOWER(trim(e.city))      = LOWER(v.city)
  AND  e.venue_id IS NULL;

-- 3.3  Medallion metadata + time domain
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS confidence_score  numeric(3, 2)
    CHECK (
      confidence_score IS NULL
      OR (confidence_score >= 0.0 AND confidence_score <= 1.0)
    ),
  ADD COLUMN IF NOT EXISTS image_hash        text,
  ADD COLUMN IF NOT EXISTS source_username   text,
  ADD COLUMN IF NOT EXISTS source_platform   text DEFAULT 'instagram',
  ADD COLUMN IF NOT EXISTS starts_at         timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at           timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4 — Scraper Observability  (ingestion_runs)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at         timestamptz NOT NULL DEFAULT now(),
  ended_at           timestamptz,
  posts_scanned      integer     NOT NULL DEFAULT 0,
  duplicates_skipped integer     NOT NULL DEFAULT 0,
  events_extracted   integer     NOT NULL DEFAULT 0,
  ai_calls_made      integer     NOT NULL DEFAULT 0,
  average_confidence numeric(3, 2),
  status             text        NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5 — Performance Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- Partial index the Silver worker polls against
CREATE INDEX IF NOT EXISTS idx_pending_events_worker_queue
  ON pending_events (created_at ASC)
  WHERE status = 'PENDING' AND ai_raw_response IS NULL;

-- Hash-collision lookup (near-duplicate detection)
CREATE INDEX IF NOT EXISTS idx_pending_events_image_hash
  ON pending_events (image_hash)
  WHERE image_hash IS NOT NULL;

-- Freshness / re-scrape visibility
CREATE INDEX IF NOT EXISTS idx_pending_events_last_seen
  ON pending_events (last_seen_at DESC);

-- Events table queries
CREATE INDEX IF NOT EXISTS idx_events_venue_id
  ON events (venue_id)
  WHERE venue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_event_date
  ON events (event_date DESC);

-- Ingestion run monitoring
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_started
  ON ingestion_runs (started_at DESC);

COMMIT;
