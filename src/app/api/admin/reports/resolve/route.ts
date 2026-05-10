import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CORRECTABLE_FIELDS } from '@/types/reports';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const VALID_FIELDS = new Set(Object.keys(CORRECTABLE_FIELDS));

export async function POST(request: Request) {
  try {
    const { password, reportId, action } = await request.json();

    if (password !== (process.env.ADMIN_PASSWORD || 'afterfive')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!reportId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Fetch the report
    const { data: report, error: fetchErr } = await supabase
      .from('user_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (fetchErr || !report) {
      return NextResponse.json({ message: 'Report not found' }, { status: 404 });
    }

    if (report.status !== 'pending') {
      return NextResponse.json({ message: 'Report already resolved' }, { status: 409 });
    }

    if (action === 'approve' && report.type === 'data_correction') {
      // Validate field against whitelist before writing to DB
      if (!VALID_FIELDS.has(report.field_name)) {
        return NextResponse.json({ message: 'Invalid field name in report' }, { status: 400 });
      }
      if (!report.event_id) {
        return NextResponse.json({ message: 'Report has no linked event' }, { status: 400 });
      }

      // Apply correction to live events table
      const { error: updateErr } = await supabase
        .from('events')
        .update({ [report.field_name]: report.proposed_value })
        .eq('id', report.event_id);

      if (updateErr) {
        return NextResponse.json({ message: updateErr.message }, { status: 500 });
      }
    }

    // Mark report resolved
    const { error: resolveErr } = await supabase
      .from('user_reports')
      .update({
        status:      action === 'approve' ? 'approved' : 'rejected',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    if (resolveErr) throw new Error(resolveErr.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
