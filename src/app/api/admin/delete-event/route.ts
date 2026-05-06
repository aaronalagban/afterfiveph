import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ALLOWED_TABLES = new Set(['pending_events', 'events']);

export async function DELETE(request: Request) {
  try {
    const { password, table, id } = await request.json();

    if (password !== (process.env.ADMIN_PASSWORD || 'afterfive')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!id || !table || !ALLOWED_TABLES.has(table as string)) {
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // events.id is bigint; pending_events.id is uuid
    const resolvedId = table === 'events' ? parseInt(id as string, 10) : (id as string);

    const { error } = await supabase
      .from(table as string)
      .delete()
      .eq('id', resolvedId);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
