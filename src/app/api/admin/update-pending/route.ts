import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadImageIfNeeded } from '@/lib/image-upload';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const ALLOWED_FIELDS = new Set([
  'event_name',
  'dj_name',
  'club_name',
  'city',
  'event_date',
  'image_url',
  'ig_post_url',
  'djs',
  'carousel_images',
]);

export async function PATCH(request: Request) {
  try {
    const { password, pendingEventId, fields } = await request.json();

    if (password !== (process.env.ADMIN_PASSWORD || 'afterfive')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!pendingEventId || !fields || typeof fields !== 'object') {
      return NextResponse.json({ message: 'Invalid request body' }, { status: 400 });
    }

    const sanitized: Record<string, unknown> = Object.fromEntries(
      Object.entries(fields).filter(([key]) => ALLOWED_FIELDS.has(key))
    );

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ message: 'No valid fields to update' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Re-host any raw IG / external image URL into Supabase storage
    if (typeof sanitized.image_url === 'string' && sanitized.image_url) {
      sanitized.image_url = await uploadImageIfNeeded(
        sanitized.image_url,
        supabase,
        String(pendingEventId)
      );
    }

    const { error } = await supabase
      .from('pending_events')
      .update(sanitized)
      .eq('id', pendingEventId);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, image_url: sanitized.image_url ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
