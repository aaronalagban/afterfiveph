-- Run this in Supabase SQL Editor to enable the user reports feature.

-- 1. User reports table (data corrections + bug reports)
CREATE TABLE IF NOT EXISTS public.user_reports (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type             text        NOT NULL CHECK (type IN ('data_correction', 'bug_report')),
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'approved', 'rejected')),

  -- Data correction fields
  event_id         bigint      REFERENCES public.events(id) ON DELETE SET NULL,
  event_name       text,
  field_name       text,
  proposed_value   text,

  -- Bug report fields
  description      text,
  screenshot_urls  text[],

  created_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz
);

-- 2. Fast lookup for admin queue (pending reports first, newest first)
CREATE INDEX IF NOT EXISTS idx_user_reports_status
  ON public.user_reports (status, created_at DESC);

-- 3. Storage bucket for bug report screenshots
--    Run manually in Supabase Dashboard → Storage → New Bucket
--    Name: report-screenshots
--    Public: true
--    Allowed MIME types: image/jpeg, image/png, image/webp, image/gif
