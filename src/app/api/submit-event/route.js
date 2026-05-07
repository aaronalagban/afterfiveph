import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";
import { Resend } from 'resend';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

const resend = new Resend(process.env.RESEND_API_KEY);

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

    // Send notification email — fire-and-forget, non-blocking
    try {
      const djList = djsArray.length > 0 ? djsArray.join(', ') : 'N/A';
      const safeUrl = encodeURI(igPostUrl);
      await resend.emails.send({
        from: 'AfterFivePH <onboarding@resend.dev>',
        to: 'collective.afterfive@gmail.com',
        subject: `New Event Submission: ${escapeHtml(eventName)}`,
        html: `
          <h2>New Event Submission</h2>
          <table cellpadding="8" style="border-collapse:collapse;width:100%;font-family:monospace;">
            <tr><td><strong>Event Name</strong></td><td>${escapeHtml(eventName)}</td></tr>
            <tr><td><strong>Date</strong></td><td>${escapeHtml(eventDate)}</td></tr>
            <tr><td><strong>Venue</strong></td><td>${escapeHtml(clubName)}</td></tr>
            <tr><td><strong>DJs</strong></td><td>${escapeHtml(djList)}</td></tr>
            <tr><td><strong>IG Post</strong></td><td><a href="${safeUrl}">${escapeHtml(igPostUrl)}</a></td></tr>
          </table>
        `,
      });
    } catch (emailError) {
      console.error("Email notification failed:", emailError);
    }

    return NextResponse.json({ success: true, message: "Added to queue" });

  } catch (error) {
    console.error("Submission error:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}