import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const SELECT_COLS = [
  'id', 'event_name', 'dj_name', 'club_name', 'city', 'event_date',
  'image_url', 'ig_post_url', 'djs', 'carousel_images', 'source', 'status',
  'created_at', 'starts_at', 'ends_at', 'confidence_score', 'raw_caption',
  'ocr_text', 'scraper_notes', 'source_username', 'parse_method',
].join(', ');

export async function POST(request: Request) {
  try {
    const { password, source, statuses } = await request.json();

    if (password !== (process.env.ADMIN_PASSWORD || 'afterfive')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const supabase = db();
    const statusFilter: string[] = Array.isArray(statuses) && statuses.length
      ? statuses
      : ['PENDING'];

    let query = supabase
      .from('pending_events')
      .select(SELECT_COLS)
      .in('status', statusFilter)
      .order('confidence_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (source) query = query.eq('source', source);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
