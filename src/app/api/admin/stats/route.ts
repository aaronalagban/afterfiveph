import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    if (password !== (process.env.ADMIN_PASSWORD || 'afterfive')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const supabase = db();

    const [
      eventsCount,
      pendingCount,
      artistsCount,
      venuesCount,
      artistLinks,
      eventVenues,
    ] = await Promise.all([
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('pending_events').select('*', { count: 'exact', head: true }),
      supabase.from('artists').select('*', { count: 'exact', head: true }),
      supabase.from('venues').select('*', { count: 'exact', head: true }),
      supabase.from('event_artists').select('artist_id'),
      supabase.from('events').select('venue_id').not('venue_id', 'is', null),
    ]);

    // Aggregate artist event counts
    const artistIdCounts: Record<string, number> = {};
    for (const link of artistLinks.data ?? []) {
      artistIdCounts[link.artist_id] = (artistIdCounts[link.artist_id] ?? 0) + 1;
    }

    const topArtistIds = Object.entries(artistIdCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    const { data: topArtistData } = topArtistIds.length
      ? await supabase.from('artists').select('id, name').in('id', topArtistIds)
      : { data: [] };

    const topArtists = topArtistIds.map(id => ({
      id,
      name: topArtistData?.find(a => a.id === id)?.name ?? 'Unknown',
      event_count: artistIdCounts[id] ?? 0,
    }));

    // Aggregate venue event counts
    const venueIdCounts: Record<string, number> = {};
    for (const event of eventVenues.data ?? []) {
      if (event.venue_id) {
        venueIdCounts[event.venue_id] = (venueIdCounts[event.venue_id] ?? 0) + 1;
      }
    }

    const topVenueIds = Object.entries(venueIdCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    const { data: topVenueData } = topVenueIds.length
      ? await supabase.from('venues').select('id, name, city').in('id', topVenueIds)
      : { data: [] };

    const topVenues = topVenueIds.map(id => ({
      id,
      name: topVenueData?.find(v => v.id === id)?.name ?? 'Unknown',
      city: topVenueData?.find(v => v.id === id)?.city ?? '',
      event_count: venueIdCounts[id] ?? 0,
    }));

    return NextResponse.json({
      total_live_events: eventsCount.count ?? 0,
      total_pending_events: pendingCount.count ?? 0,
      total_artists: artistsCount.count ?? 0,
      total_venues: venuesCount.count ?? 0,
      top_artists: topArtists,
      top_venues: topVenues,
    });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
