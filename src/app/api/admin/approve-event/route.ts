import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { publishEvent } from '../../../../features/events/event-publisher';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    const { password, pendingEventId } = await request.json();

    if (password !== (process.env.ADMIN_PASSWORD || 'afterfive')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!pendingEventId) {
      return NextResponse.json({ message: 'Missing pendingEventId' }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: pendingEvent, error: fetchError } = await supabase
      .from('pending_events')
      .select('*')
      .eq('id', pendingEventId)
      .single();

    if (fetchError || !pendingEvent) {
      return NextResponse.json({ message: 'Pending event not found' }, { status: 404 });
    }

    // Resolve djs — prefer the array, fall back to comma-splitting dj_name
    const djs: string[] =
      pendingEvent.djs?.length > 0
        ? pendingEvent.djs
        : (pendingEvent.dj_name ?? '')
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean);

    const eventId = await publishEvent(
      {
        event_name:     pendingEvent.event_name,
        club_name:      pendingEvent.club_name,
        city:           pendingEvent.city ?? 'Makati',
        event_date:     pendingEvent.event_date,
        djs,
        dj_name:        djs.join(', ') || 'Various Artists',
        image_url:      pendingEvent.image_url,
        ig_post_url:    pendingEvent.ig_post_url,
        starts_at:      pendingEvent.starts_at  ?? null,
        ends_at:        pendingEvent.ends_at    ?? null,
        confidence_score: pendingEvent.confidence_score ?? null,
        image_hash:     pendingEvent.image_hash ?? null,
        source_username: pendingEvent.source_username ?? null,
        source_platform: 'instagram',
        source_priority: 100, // admin approval wins over any scraper data
      },
      supabase
    );

    if (!eventId) {
      return NextResponse.json({ message: 'Failed to publish event' }, { status: 500 });
    }

    await supabase
      .from('pending_events')
      .update({ status: 'APPROVED' })
      .eq('id', pendingEventId);

    return NextResponse.json({ success: true, eventId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
