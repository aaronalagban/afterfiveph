-- TEMPORARY — Fête de la Musique PH 2026 campaign.
-- Run this in the Supabase SQL Editor to let admins tag events for the
-- user-facing FETE GUIDE.
--
-- This is intentionally a single boolean flag on the existing `events`
-- table (consistent with how this codebase already tags events, e.g.
-- `starts_at`/`ends_at`), not a new tagging table — there's no existing
-- tagging/metadata infrastructure to hang a generic `event_tags` table off
-- of, so a column is the lowest-risk option for a campaign this short.
--
-- Cleanup: run scripts/fete-2026-cleanup.sql after the campaign window
-- closes (after 2026-06-29 / Asia/Manila) to drop this column.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_fete_2026 boolean NOT NULL DEFAULT false;

-- Partial index — only indexes the (small) set of tagged rows.
CREATE INDEX IF NOT EXISTS idx_events_is_fete_2026
  ON public.events (is_fete_2026)
  WHERE is_fete_2026 = true;
