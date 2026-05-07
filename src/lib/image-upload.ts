import { SupabaseClient } from '@supabase/supabase-js';

const BLOCKED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function isInternalHost(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  return false;
}

export async function uploadImageIfNeeded(
  imageUrl: string,
  supabase: SupabaseClient,
  slug: string
): Promise<string> {
  const supabaseOrigin = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');

  if (supabaseOrigin && imageUrl.startsWith(supabaseOrigin)) {
    return imageUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new Error('Invalid image URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https image URLs allowed');
  }

  if (isInternalHost(parsed.hostname)) {
    throw new Error('Internal image URLs not allowed');
  }

  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Image download failed (${res.status}): ${imageUrl}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const safeSlug = slug.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 40);
  const fileName = `admin-swap-${safeSlug}-${Date.now()}.jpg`;

  const { error } = await supabase.storage.from('event-flyers').upload(fileName, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  return supabase.storage.from('event-flyers').getPublicUrl(fileName).data.publicUrl;
}
