import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function unauthorized() {
  return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    const { password, action, payload } = await request.json();

    if (password !== (process.env.ADMIN_PASSWORD || 'afterfive')) {
      return unauthorized();
    }

    const db = getAdminClient();

    // ─────────────────────────────────────────────────────────────────────────
    // READS
    // ─────────────────────────────────────────────────────────────────────────

    if (action === 'fetch_artists') {
      const { data: artists, error } = await db
        .from('artists')
        .select('id, name, ig_handle')
        .is('ig_handle', null);

      if (error) return NextResponse.json({ message: error.message }, { status: 500 });
      if (!artists?.length) return NextResponse.json({ data: [] });

      const { data: links } = await db
        .from('event_artists')
        .select('artist_id')
        .in('artist_id', artists.map(a => a.id));

      const counts: Record<string, number> = {};
      for (const row of links ?? []) {
        counts[row.artist_id] = (counts[row.artist_id] ?? 0) + 1;
      }

      return NextResponse.json({
        data: artists
          .map(a => ({ ...a, event_count: counts[a.id] ?? 0 }))
          .sort((a, b) => b.event_count - a.event_count),
      });
    }

    if (action === 'fetch_venues') {
      const { data: venues, error } = await db
        .from('venues')
        .select('id, name, city, ig_handle, address, google_maps_url, created_at')
        .or('ig_handle.is.null,address.is.null');

      if (error) return NextResponse.json({ message: error.message }, { status: 500 });
      if (!venues?.length) return NextResponse.json({ data: [] });

      const { data: links } = await db
        .from('events')
        .select('venue_id')
        .in('venue_id', venues.map(v => v.id));

      const counts: Record<string, number> = {};
      for (const row of links ?? []) {
        if (row.venue_id) counts[row.venue_id] = (counts[row.venue_id] ?? 0) + 1;
      }

      return NextResponse.json({
        data: venues
          .map(v => ({ ...v, event_count: counts[v.id] ?? 0 }))
          .sort((a, b) => b.event_count - a.event_count),
      });
    }

    if (action === 'fetch_orphaned') {
      const today = new Date().toISOString().split('T')[0];

      const { data: noVenue } = await db
        .from('events')
        .select('id, event_name, event_date, image_url, club_name, city, dj_name, djs, venue_id')
        .is('venue_id', null)
        .gte('event_date', today);

      const { data: withVenue } = await db
        .from('events')
        .select('id, event_name, event_date, image_url, club_name, city, dj_name, djs, venue_id')
        .not('venue_id', 'is', null)
        .gte('event_date', today);

      const all = [...(noVenue ?? []), ...(withVenue ?? [])];
      if (!all.length) return NextResponse.json({ data: [] });

      const { data: linked } = await db
        .from('event_artists')
        .select('event_id')
        .in('event_id', all.map(e => e.id));

      const hasArtists = new Set((linked ?? []).map(r => r.event_id));

      const seen = new Set<number>();
      const orphaned = all
        .filter(e => !e.venue_id || !hasArtists.has(e.id))
        .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; })
        .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

      return NextResponse.json({ data: orphaned });
    }

    if (action === 'fetch_all_venues') {
      const { data } = await db
        .from('venues')
        .select('id, name, city')
        .eq('is_active', true)
        .order('name');
      return NextResponse.json({ data: data ?? [] });
    }

    if (action === 'fetch_all_artists') {
      const { data } = await db
        .from('artists')
        .select('id, name, ig_handle')
        .order('name');
      return NextResponse.json({ data: data ?? [] });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // WRITES
    // ─────────────────────────────────────────────────────────────────────────

    if (action === 'update_artist') {
      const { id, ig_handle } = payload as { id: string; ig_handle: string };
      const clean = ig_handle?.replace(/^@/, '').trim() || null;

      if (clean) {
        const { data: conflict } = await db
          .from('artists')
          .select('id, name')
          .eq('ig_handle', clean)
          .neq('id', id)
          .maybeSingle();

        if (conflict) {
          return NextResponse.json(
            { message: `@${clean} is already linked to "${conflict.name}"` },
            { status: 409 }
          );
        }
      }

      const { error } = await db.from('artists').update({ ig_handle: clean }).eq('id', id);
      if (error) return NextResponse.json({ message: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'update_venue') {
      const { id, fields } = payload as { id: string; fields: Record<string, string | null> };

      if (fields.ig_handle) {
        const clean = fields.ig_handle.replace(/^@/, '').trim();
        const { data: conflict } = await db
          .from('venues')
          .select('id, name')
          .eq('ig_handle', clean)
          .neq('id', id)
          .maybeSingle();

        if (conflict) {
          return NextResponse.json(
            { message: `@${clean} is already linked to "${conflict.name}"` },
            { status: 409 }
          );
        }
        fields.ig_handle = clean;
      }

      const { error } = await db.from('venues').update(fields).eq('id', id);
      if (error) return NextResponse.json({ message: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'reassign_event') {
      const { event_id, venue_id, artist_ids } = payload as {
        event_id: number;
        venue_id?: string | null;
        artist_ids?: string[];
      };

      if (venue_id !== undefined) {
        const { error } = await db.from('events').update({ venue_id }).eq('id', event_id);
        if (error) return NextResponse.json({ message: error.message }, { status: 500 });
      }

      if (artist_ids !== undefined) {
        await db.from('event_artists').delete().eq('event_id', event_id);

        if (artist_ids.length > 0) {
          const { error } = await db
            .from('event_artists')
            .insert(artist_ids.map(aid => ({ event_id, artist_id: aid })));
          if (error) return NextResponse.json({ message: error.message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
