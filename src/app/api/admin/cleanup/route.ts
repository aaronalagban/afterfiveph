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

// ── Similarity helpers (used for duplicate detection) ─────────────────────────

type SimilarityReason = 'case_duplicate' | 'substring_match' | 'trigram_similar';

function buildTrigrams(s: string): Set<string> {
  const p = `  ${s.toLowerCase()}  `;
  const set = new Set<string>();
  for (let i = 0; i <= p.length - 3; i++) set.add(p.slice(i, i + 3));
  return set;
}

function trigramSim(a: string, b: string): number {
  const ta = buildTrigrams(a), tb = buildTrigrams(b);
  let n = 0;
  for (const t of ta) if (tb.has(t)) n++;
  return (2 * n) / (ta.size + tb.size);
}

interface SimilarGroup { indices: number[]; reason: SimilarityReason; confidence: number }

function groupSimilar(names: string[], threshold = 0.45): SimilarGroup[] {
  const n = names.length;
  if (n < 2) return [];

  interface Pair { i: number; j: number; reason: SimilarityReason; confidence: number }
  const PRIO: Record<SimilarityReason, number> = { case_duplicate: 3, substring_match: 2, trigram_similar: 1 };
  const pairs: Pair[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = names[i].toLowerCase().trim();
      const b = names[j].toLowerCase().trim();
      if (a === b) {
        pairs.push({ i, j, reason: 'case_duplicate', confidence: 1.0 });
      } else if (a.includes(b) || b.includes(a)) {
        pairs.push({ i, j, reason: 'substring_match', confidence: 0.85 });
      } else {
        const sim = trigramSim(a, b);
        if (sim >= threshold) pairs.push({ i, j, reason: 'trigram_similar', confidence: sim });
      }
    }
  }
  if (!pairs.length) return [];

  const parent = Array.from({ length: n }, (_, k) => k);
  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  for (const { i, j } of pairs) {
    const ri = find(i), rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  }

  const groupMap = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groupMap.has(root)) groupMap.set(root, []);
    groupMap.get(root)!.push(i);
  }

  const results: SimilarGroup[] = [];
  for (const [, indices] of groupMap) {
    if (indices.length < 2) continue;
    const idxSet = new Set(indices);
    let bestReason: SimilarityReason = 'trigram_similar';
    let bestConf = threshold;
    for (const p of pairs) {
      if (!idxSet.has(p.i) || !idxSet.has(p.j)) continue;
      if (PRIO[p.reason] > PRIO[bestReason] || (p.reason === bestReason && p.confidence > bestConf)) {
        bestReason = p.reason; bestConf = p.confidence;
      }
    }
    results.push({ indices, reason: bestReason, confidence: bestConf });
  }
  return results;
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

    // ─────────────────────────────────────────────────────────────────────────
    // DUPLICATE DETECTION
    // ─────────────────────────────────────────────────────────────────────────

    if (action === 'fetch_suggestions') {
      // Load dismissed group keys (best-effort — table may not exist yet)
      const dismissedKeys = new Set<string>();
      try {
        const { data: dismissals } = await db.from('cleanup_dismissals').select('entity_ids');
        for (const row of dismissals ?? []) {
          dismissedKeys.add([...row.entity_ids].sort().join(','));
        }
      } catch { /* table not migrated yet */ }

      const [{ data: artists }, { data: venues }] = await Promise.all([
        db.from('artists').select('id, name, ig_handle').order('name'),
        db.from('venues').select('id, name, city, ig_handle').order('name'),
      ]);

      function buildGroups<T extends { id: string; name: string; ig_handle?: string | null; city?: string | null }>(
        rows: T[], type: 'artist' | 'venue'
      ) {
        const names = rows.map(r => r.name);
        return groupSimilar(names)
          .map(({ indices, reason, confidence }) => {
            const members = indices.map(i => rows[i]);
            const key = members.map(m => m.id).sort().join(',');
            if (dismissedKeys.has(key)) return null;
            return {
              id: key, type, reason, confidence,
              members: members.map(m => ({
                id: m.id, name: m.name,
                secondary: m.city ?? m.ig_handle ?? null,
              })),
            };
          })
          .filter(Boolean);
      }

      const data = [
        ...buildGroups(artists ?? [], 'artist'),
        ...buildGroups(venues  ?? [], 'venue'),
      ];
      return NextResponse.json({ data });
    }

    if (action === 'merge_entities') {
      const { type, primaryId, memberIds } = payload as {
        type: 'artist' | 'venue'; primaryId: string; memberIds: string[];
      };
      if (!type || !primaryId || !memberIds?.length) {
        return NextResponse.json({ message: 'Missing fields' }, { status: 400 });
      }
      const duplicateIds = memberIds.filter(id => id !== primaryId);
      if (!duplicateIds.length) {
        return NextResponse.json({ message: 'No duplicates to merge' }, { status: 400 });
      }

      const { data: dupRows, error: fetchErr } = await db
        .from(type === 'artist' ? 'artists' : 'venues')
        .select('id, name')
        .in('id', duplicateIds);
      if (fetchErr) return NextResponse.json({ message: fetchErr.message }, { status: 500 });

      if (type === 'artist') {
        // Find events already linked to primary to avoid PK conflicts on event_artists
        const { data: primaryLinks } = await db
          .from('event_artists').select('event_id').eq('artist_id', primaryId);
        const conflictIds = (primaryLinks ?? []).map((r: { event_id: number }) => r.event_id);

        if (conflictIds.length > 0) {
          const { error } = await db.from('event_artists').delete()
            .in('artist_id', duplicateIds).in('event_id', conflictIds);
          if (error) return NextResponse.json({ message: error.message }, { status: 500 });
        }

        const { error: reassignErr } = await db.from('event_artists')
          .update({ artist_id: primaryId }).in('artist_id', duplicateIds);
        if (reassignErr) return NextResponse.json({ message: reassignErr.message }, { status: 500 });

        try {
          const aliases = (dupRows ?? []).map(r => ({ artist_id: primaryId, alias: r.name }));
          if (aliases.length) await db.from('artist_aliases')
            .upsert(aliases, { onConflict: 'alias', ignoreDuplicates: true });
        } catch { /* alias table may not exist yet */ }

        const { error: delErr } = await db.from('artists').delete().in('id', duplicateIds);
        if (delErr) return NextResponse.json({ message: delErr.message }, { status: 500 });

      } else {
        const { error: reassignErr } = await db.from('events')
          .update({ venue_id: primaryId }).in('venue_id', duplicateIds);
        if (reassignErr) return NextResponse.json({ message: reassignErr.message }, { status: 500 });

        try {
          const aliases = (dupRows ?? []).map(r => ({ venue_id: primaryId, alias: r.name }));
          if (aliases.length) await db.from('venue_aliases')
            .upsert(aliases, { onConflict: 'alias', ignoreDuplicates: true });
        } catch { /* alias table may not exist yet */ }

        const { error: delErr } = await db.from('venues').delete().in('id', duplicateIds);
        if (delErr) return NextResponse.json({ message: delErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, merged: duplicateIds.length });
    }

    if (action === 'delete_entities') {
      const { type, memberIds } = payload as { type: 'artist' | 'venue'; memberIds: string[] };

      if (type === 'artist') {
        const { error: e1 } = await db.from('event_artists').delete().in('artist_id', memberIds);
        if (e1) return NextResponse.json({ message: e1.message }, { status: 500 });
        const { error: e2 } = await db.from('artists').delete().in('id', memberIds);
        if (e2) return NextResponse.json({ message: e2.message }, { status: 500 });
      } else {
        const { error: e1 } = await db.from('events').update({ venue_id: null }).in('venue_id', memberIds);
        if (e1) return NextResponse.json({ message: e1.message }, { status: 500 });
        const { error: e2 } = await db.from('venues').delete().in('id', memberIds);
        if (e2) return NextResponse.json({ message: e2.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'dismiss_suggestion') {
      const { type, memberIds } = payload as { type: 'artist' | 'venue'; memberIds: string[] };
      try {
        await db.from('cleanup_dismissals').insert({
          entity_type: type,
          entity_ids: [...memberIds].sort(),
        });
      } catch { /* table may not exist yet, silently continue */ }
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
