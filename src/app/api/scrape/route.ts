import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { events } = await request.json();

    const rows = events.map((event: any) => ({
      // Map to your EXACT schema columns
      event_name: event.event_name || "Special Event",
      club_name: event.club_name,
      city: event.city || "Manila",
      event_date: event.event_date,
      image_url: event.image_url,
      ig_post_url: event.ig_post_url,
      djs: event.djs || [],
      // Combine DJs for the legacy 'dj_name' column
      dj_name: Array.isArray(event.djs) && event.djs.length > 0 
        ? event.djs.join(" / ") 
        : (event.dj_name || "TBA")
    }));

    // UPSERT: This prevents the duplicates
    const { error } = await supabase
      .from('events')
      .upsert(rows, { onConflict: 'club_name,event_date' });

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Sync Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}