import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { events } = await request.json();

    if (!Array.isArray(events)) {
      return NextResponse.json(
        { success: false, error: "Invalid events payload" },
        { status: 400 }
      );
    }

    const rows = events.map((event: any) => ({
    event_name: event.event_name || "Special Event",
      club_name: event.club_name,
      city: event.city || "Manila",
      event_date: event.event_date,
      image_url: event.image_url,
      ig_post_url: event.ig_post_url,
      djs: event.djs || [],
      dj_name:
        Array.isArray(event.djs) && event.djs.length > 0
          ? event.djs.join(" / ")
          : event.dj_name || "TBA",
    }));

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("events")
      .upsert(rows, { onConflict: "club_name,event_date" });

    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Sync Error:", error.message);

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}