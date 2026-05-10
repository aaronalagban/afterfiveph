import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadImageIfNeeded } from '@/lib/image-upload';
import { publishEvent } from '@/features/events/event-publisher';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ALLOWED_FIELDS = new Set([
  'event_name', 'dj_name', 'club_name', 'city', 'event_date',
  'image_url', 'ig_post_url', 'djs', 'carousel_images',
  'starts_at', 'ends_at',
]);

export async function POST(request: Request) {
  try {
    const { password, pendingEventId, fields = {} } = await request.json();

    if (password !== (process.env.ADMIN_PASSWORD || 'afterfive')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    if (!pendingEventId) {
      return NextResponse.json({ message: 'Missing pendingEventId' }, { status: 400 });
    }

    const supabase = db();

    const { data: pending, error: fetchErr } = await supabase
      .from('pending_events')
      .select('*')
      .eq('id', pendingEventId)
      .single();

    if (fetchErr || !pending) {
      return NextResponse.json({ message: 'Pending event not found' }, { status: 404 });
    }

    // Sanitize incoming field overrides
    const sanitized: Record<string, unknown> = Object.fromEntries(
      Object.entries(fields).filter(([k]) => ALLOWED_FIELDS.has(k))
    );

    // Re-host image if URL changed to an external source
    if (typeof sanitized.image_url === 'string' && sanitized.image_url) {
      sanitized.image_url = await uploadImageIfNeeded(
        sanitized.image_url, supabase, String(pendingEventId)
      );
    }

    // Merge admin edits onto the fetched record
    const merged = { ...pending, ...sanitized };

    const djs: string[] =
      Array.isArray(merged.djs) && merged.djs.length > 0
        ? merged.djs
        : (merged.dj_name ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);

    const eventId = await publishEvent(
      {
        event_name:      merged.event_name,
        club_name:       merged.club_name,
        city:            merged.city ?? 'Makati',
        event_date:      merged.event_date,
        djs,
        dj_name:         djs.join(', ') || 'Various Artists',
        image_url:       merged.image_url,
        ig_post_url:     merged.ig_post_url,
        starts_at:       merged.starts_at ?? null,
        ends_at:         merged.ends_at   ?? null,
        confidence_score: merged.confidence_score ?? null,
        image_hash:       merged.image_hash ?? null,
        source_username:  merged.source_username ?? null,
        source_platform:  'instagram',
        source_priority:  100,
      },
      supabase
    );

    if (!eventId) {
      return NextResponse.json({ message: 'Failed to publish event' }, { status: 500 });
    }

    // Atomically save any field edits + mark approved
    await supabase
      .from('pending_events')
      .update({ ...sanitized, status: 'APPROVED' })
      .eq('id', pendingEventId);

    return NextResponse.json({ success: true, eventId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
