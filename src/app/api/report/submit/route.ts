import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { CORRECTABLE_FIELDS } from '@/types/reports';

const resend = new Resend(process.env.RESEND_API_KEY);

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

const VALID_FIELDS = new Set(Object.keys(CORRECTABLE_FIELDS));
const MAX_DESCRIPTION = 2000;
const MAX_FILE_SIZE   = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME    = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function POST(request: Request) {
  try {
    const fd        = await request.formData();
    const type      = fd.get('type') as string;
    const eventId   = fd.get('event_id') as string;
    const eventName = fd.get('event_name') as string | null;

    if (!['data_correction', 'bug_report'].includes(type)) {
      return NextResponse.json({ message: 'Invalid report type' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const report: Record<string, unknown> = { type, event_name: eventName ?? null };

    if (eventId) {
      const parsed = parseInt(eventId, 10);
      if (!isNaN(parsed)) report.event_id = parsed;
    }

    if (type === 'data_correction') {
      const fieldName = fd.get('field_name') as string;
      const proposed  = fd.get('proposed_value') as string;

      if (!VALID_FIELDS.has(fieldName)) {
        return NextResponse.json({ message: 'Invalid field name' }, { status: 400 });
      }
      if (!proposed?.trim()) {
        return NextResponse.json({ message: 'Proposed value is required' }, { status: 400 });
      }

      report.field_name     = fieldName;
      report.proposed_value = proposed.trim().slice(0, 500);

    } else {
      const description = fd.get('description') as string;
      if (!description?.trim()) {
        return NextResponse.json({ message: 'Description is required' }, { status: 400 });
      }
      report.description = description.trim().slice(0, MAX_DESCRIPTION);

      // Upload screenshots to Supabase Storage
      const screenshots = fd.getAll('screenshots') as File[];
      const uploadedUrls: string[] = [];

      for (const file of screenshots.slice(0, 3)) {
        if (!ALLOWED_MIME.has(file.type)) continue;
        if (file.size > MAX_FILE_SIZE) continue;

        const ext      = file.name.split('.').pop() ?? 'jpg';
        const path     = `${crypto.randomUUID()}.${ext}`;
        const buffer   = await file.arrayBuffer();

        const { error: uploadError } = await supabase.storage
          .from('report-screenshots')
          .upload(path, buffer, { contentType: file.type, upsert: false });

        if (!uploadError) {
          const { data } = supabase.storage
            .from('report-screenshots')
            .getPublicUrl(path);
          uploadedUrls.push(data.publicUrl);
        }
      }

      if (uploadedUrls.length > 0) report.screenshot_urls = uploadedUrls;
    }

    // Insert report
    const { data: inserted, error: dbError } = await supabase
      .from('user_reports')
      .insert(report)
      .select('id')
      .single();

    if (dbError) throw new Error(dbError.message);

    // Send notification email — fire-and-forget
    const isCorrection = type === 'data_correction';
    const subject      = isCorrection
      ? `New Data Correction Request — ${eventName ?? 'Unknown Event'}`
      : `New Bug Report — ${eventName ?? 'Unknown Event'}`;

    try {
      const html = isCorrection
        ? `
          <h2>Data Correction Request</h2>
          <table cellpadding="8" style="border-collapse:collapse;width:100%;font-family:monospace;">
            <tr><td><strong>Report ID</strong></td><td>${escapeHtml(String(inserted.id))}</td></tr>
            <tr><td><strong>Event</strong></td><td>${escapeHtml(eventName ?? 'N/A')}</td></tr>
            <tr><td><strong>Event ID</strong></td><td>${escapeHtml(String(report.event_id ?? 'N/A'))}</td></tr>
            <tr><td><strong>Field</strong></td><td>${escapeHtml(CORRECTABLE_FIELDS[report.field_name as string] ?? String(report.field_name))}</td></tr>
            <tr><td><strong>Proposed Value</strong></td><td>${escapeHtml(String(report.proposed_value))}</td></tr>
          </table>
          <p style="font-family:monospace;font-size:12px;color:#666;">Review in AfterFive CMS → Reports tab.</p>
        `
        : `
          <h2>Bug Report</h2>
          <table cellpadding="8" style="border-collapse:collapse;width:100%;font-family:monospace;">
            <tr><td><strong>Report ID</strong></td><td>${escapeHtml(String(inserted.id))}</td></tr>
            <tr><td><strong>Event</strong></td><td>${escapeHtml(eventName ?? 'N/A')}</td></tr>
            <tr><td><strong>Description</strong></td><td style="white-space:pre-wrap">${escapeHtml(String(report.description))}</td></tr>
            ${(report.screenshot_urls as string[] ?? []).map((u, i) => `<tr><td><strong>Screenshot ${i + 1}</strong></td><td><a href="${encodeURI(u)}">${escapeHtml(u)}</a></td></tr>`).join('')}
          </table>
          <p style="font-family:monospace;font-size:12px;color:#666;">Review in AfterFive CMS → Reports tab.</p>
        `;

      await resend.emails.send({
        from: 'AfterFivePH <onboarding@resend.dev>',
        to:   'collective.afterfive@gmail.com',
        subject,
        html,
      });
    } catch (emailErr) {
      console.error('Report email failed:', emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
