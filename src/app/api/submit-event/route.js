import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  try {
    const body = await request.json();
    const { eventName, djs, eventDate, clubName, igPostUrl } = body;

    // Basic validation
    if (!eventName || !eventDate || !clubName || !igPostUrl) {
      return NextResponse.json({ message: "Missing fields" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const djsArray = djs ? djs.split(",").map(dj => dj.trim()).filter(Boolean) : [];

    const { error } = await supabaseAdmin.from('pending_events').insert({
      event_name: eventName,
      djs: djsArray,
      event_date: eventDate,
      club_name: clubName,
      ig_post_url: igPostUrl,
      status: 'pending'
    });

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Added to queue" });

  } catch (error) {
    console.error("Submission error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}