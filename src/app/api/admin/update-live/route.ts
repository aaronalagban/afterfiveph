import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ALLOWED_FIELDS = new Set([
  'event_name',
  'dj_name',
  'club_name',
  'city',
  'event_date',
  'image_url',
  'ig_post_url',
  'djs',
]);

export async function PATCH(request: Request) {
  try {
    const { password, eventId, fields } = await request.json();

    if (password !== (process.env.ADMIN_PASSWORD || 'afterfive')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!eventId || !fields || typeof fields !== 'object') {
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
    }

    const sanitized = Object.fromEntries(
      Object.entries(fields).filter(([key]) => ALLOWED_FIELDS.has(key))
    );

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ message: 'No valid fields to update' }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { error } = await supabase
      .from('events')
      .update(sanitized)
      .eq('id', parseInt(eventId, 10));

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
