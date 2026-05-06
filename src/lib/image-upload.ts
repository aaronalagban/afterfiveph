import { SupabaseClient } from '@supabase/supabase-js';

/**
 * If `imageUrl` is already hosted in this project's Supabase storage, return
 * it unchanged. Otherwise download it and upload it to the `event-flyers`
 * bucket, then return the new public URL.
 *
 * This lets admins pick a raw Instagram CDN URL from the carousel grid and
 * have it permanently re-hosted before it gets written to the database.
 */
export async function uploadImageIfNeeded(
  imageUrl: string,
  supabase: SupabaseClient,
  slug: string
): Promise<string> {
  const supabaseOrigin = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');

  // Already in our storage — nothing to do
  if (supabaseOrigin && imageUrl.startsWith(supabaseOrigin)) {
    return imageUrl;
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
