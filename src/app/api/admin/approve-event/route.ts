import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    const djName =
      pendingEvent.dj_name ||
      (pendingEvent.djs?.length > 0 ? pendingEvent.djs.join(', ') : 'Various Artists');

    const { error: insertError } = await supabase.from('events').insert({
      event_name: pendingEvent.event_name,
      dj_name: djName,
      club_name: pendingEvent.club_name,
      city: pendingEvent.city || 'Makati',
      event_date: pendingEvent.event_date,
      image_url: pendingEvent.image_url,
      ig_post_url: pendingEvent.ig_post_url,
      djs: pendingEvent.djs ?? [],
      source_priority: 100,
    });

    if (insertError) {
      return NextResponse.json({ message: insertError.message }, { status: 500 });
    }

    await supabase
      .from('pending_events')
      .update({ status: 'approved' })
      .eq('id', pendingEventId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
