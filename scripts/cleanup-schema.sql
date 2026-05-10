-- Run this in Supabase SQL editor before using the Duplicates tab.

-- 1. Fuzzy string matching (needed for pg_trgm index type)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Stores the old names of merged artists so the system remembers the mapping
CREATE TABLE IF NOT EXISTS public.artist_aliases (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id   uuid        NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  alias       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artist_aliases_alias_key UNIQUE (alias)
);

-- 3. Same for venues
CREATE TABLE IF NOT EXISTS public.venue_aliases (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  alias       text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_aliases_alias_key UNIQUE (alias)
);

-- 4. Tracks groups the admin already reviewed so they don't resurface
CREATE TABLE IF NOT EXISTS public.cleanup_dismissals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  text        NOT NULL CHECK (entity_type IN ('artist', 'venue')),
  entity_ids   uuid[]      NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now()
);

-- 5. GIN indexes for fast future SQL-side fuzzy queries
CREATE INDEX IF NOT EXISTS idx_artists_name_trgm   ON public.artists       USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_venues_name_trgm    ON public.venues        USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_artist_aliases_trgm ON public.artist_aliases USING gin (lower(alias) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_venue_aliases_trgm  ON public.venue_aliases  USING gin (lower(alias) gin_trgm_ops);
