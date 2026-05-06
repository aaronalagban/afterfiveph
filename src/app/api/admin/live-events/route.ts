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
    const { password } = await request.json();

    if (password !== (process.env.ADMIN_PASSWORD || 'afterfive')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getAdminClient();
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('events')
      .select('id, event_name, dj_name, club_name, city, event_date, image_url, ig_post_url, djs')
      .gte('event_date', today)
      .order('event_date', { ascending: true });

    if (error) throw error;

    // Normalise bigint id → string so the modal can treat all ids uniformly
    const events = (data ?? []).map(e => ({ ...e, id: String(e.id) }));

    return NextResponse.json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
