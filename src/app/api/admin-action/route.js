// app/api/admin-action/route.js
import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";
import { approveAndScrapeEvent, rejectEvent } from '../../../utils/manualSubmissionServer';

export const maxDuration = 60; // Need this because approving triggers the scraper!

export async function POST(request) {
  try {
    const { password, action, eventId } = await request.json();

    if (password !== (process.env.ADMIN_PASSWORD || "afterfive")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // FETCH QUEUE
    if (action === 'fetch') {
      const { data } = await supabase
        .from('pending_events')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      return NextResponse.json({ queue: data });
    }

    // APPROVE
    if (action === 'approve') {
      await approveAndScrapeEvent(eventId);
      return NextResponse.json({ success: true });
    }

    // REJECT
    if (action === 'reject') {
      await rejectEvent(eventId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 });

  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}