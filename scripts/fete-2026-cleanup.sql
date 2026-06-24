-- TEMPORARY CLEANUP — Fête de la Musique PH 2026 campaign.
-- Run this in the Supabase SQL Editor once the campaign window has closed
-- (after 2026-06-29 / Asia/Manila — i.e. on or after 2026-06-30). Safe to
-- run any time after that date; it only removes the temporary tagging
-- column added by scripts/fete-2026-schema.sql.
--
-- Also delete at that point:
--   - src/features/fete/fete.config.ts
--   - every import of it (grep for "fete.config" or "is_fete_2026")

DROP INDEX IF EXISTS idx_events_is_fete_2026;

ALTER TABLE public.events
  DROP COLUMN IF EXISTS is_fete_2026;
