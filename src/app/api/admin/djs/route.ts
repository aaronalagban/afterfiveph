import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('events')
      .select('dj_name, djs');

    if (error) throw error;

    const djSet = new Set<string>();

    for (const row of data ?? []) {
      if (row.dj_name) {
        row.dj_name.split(',').forEach((name: string) => {
          const trimmed = name.trim();
          if (trimmed) djSet.add(trimmed);
        });
      }
      if (Array.isArray(row.djs)) {
        row.djs.forEach((name: string) => {
          const trimmed = name.trim();
          if (trimmed) djSet.add(trimmed);
        });
      }
    }

    return NextResponse.json({ djs: Array.from(djSet).sort() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
