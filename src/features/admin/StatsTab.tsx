'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Calendar, Clock, Users, MapPin, TrendingUp } from 'lucide-react';

interface Stats {
  total_live_events: number;
  total_pending_events: number;
  total_artists: number;
  total_venues: number;
  top_artists: Array<{ id: string; name: string; event_count: number }>;
  top_venues: Array<{ id: string; name: string; city: string; event_count: number }>;
}

export function StatsTab({ password }: { password: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to load stats');
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="text-center py-16 font-mono text-xs text-neutral-500 uppercase animate-pulse tracking-widest">
        Loading analytics…
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-center py-16 font-mono text-sm text-[#F53D04]">
        {error ?? 'Failed to load analytics.'}
        <button
          onClick={fetchStats}
          className="block mx-auto mt-3 font-mono text-xs text-neutral-500 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const totalEvents = stats.total_live_events + stats.total_pending_events;
  const liveRatio = totalEvents > 0
    ? Math.round((stats.total_live_events / totalEvents) * 100)
    : 0;

  const cards = [
    { label: 'Live Events',    value: stats.total_live_events,    icon: Calendar, color: '#00E5FF' },
    { label: 'Pending Review', value: stats.total_pending_events,  icon: Clock,    color: '#F59E0B' },
    { label: 'Total Artists',  value: stats.total_artists,         icon: Users,    color: '#10B981' },
    { label: 'Total Venues',   value: stats.total_venues,          icon: MapPin,   color: '#8B5CF6' },
  ];

  return (
    <div className="space-y-8">

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest">
          Platform analytics · Live data
        </p>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 border border-neutral-700 font-mono text-[10px] uppercase hover:bg-neutral-800 disabled:opacity-50 transition-colors text-neutral-400"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-[#0d0d0d] border border-neutral-800 p-5 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] text-neutral-500 uppercase tracking-widest">
                {label}
              </span>
              <Icon size={12} style={{ color }} className="opacity-50" />
            </div>
            <span className="font-black text-4xl tracking-tighter" style={{ color }}>
              {value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* Pipeline bar */}
      <div className="bg-[#0d0d0d] border border-neutral-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={11} className="text-neutral-500" />
          <span className="font-mono text-[9px] text-neutral-500 uppercase tracking-widest">
            Event pipeline · {totalEvents.toLocaleString()} total
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-1.5 bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-[#00E5FF] transition-all duration-500"
              style={{ width: `${liveRatio}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-neutral-400 whitespace-nowrap shrink-0">
            {stats.total_live_events.toLocaleString()} live
            &nbsp;/&nbsp;
            {stats.total_pending_events.toLocaleString()} pending
          </span>
        </div>
      </div>

      {/* Top tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top Artists */}
        <div>
          <h3 className="font-black text-[10px] uppercase tracking-widest text-neutral-400 mb-3">
            Top Artists&nbsp;
            <span className="text-neutral-600 font-mono font-normal">by event count</span>
          </h3>
          <div className="border border-neutral-800 overflow-hidden">
            {stats.top_artists.length === 0 ? (
              <p className="font-mono text-xs text-neutral-500 p-6 text-center">No data yet</p>
            ) : stats.top_artists.map((artist, i) => (
              <div
                key={artist.id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-neutral-800 last:border-0 ${
                  i % 2 === 0 ? 'bg-[#0d0d0d]' : 'bg-[#111]'
                }`}
              >
                <span className="font-mono text-[10px] text-neutral-600 w-5 text-right shrink-0">
                  {i + 1}
                </span>
                <span className="font-black text-sm text-white flex-1 truncate uppercase tracking-tight">
                  {artist.name}
                </span>
                <span className="font-mono text-xs text-[#00E5FF] shrink-0 tabular-nums">
                  {artist.event_count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Venues */}
        <div>
          <h3 className="font-black text-[10px] uppercase tracking-widest text-neutral-400 mb-3">
            Top Venues&nbsp;
            <span className="text-neutral-600 font-mono font-normal">by event count</span>
          </h3>
          <div className="border border-neutral-800 overflow-hidden">
            {stats.top_venues.length === 0 ? (
              <p className="font-mono text-xs text-neutral-500 p-6 text-center">No data yet</p>
            ) : stats.top_venues.map((venue, i) => (
              <div
                key={venue.id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-neutral-800 last:border-0 ${
                  i % 2 === 0 ? 'bg-[#0d0d0d]' : 'bg-[#111]'
                }`}
              >
                <span className="font-mono text-[10px] text-neutral-600 w-5 text-right shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-black text-sm text-white block truncate uppercase tracking-tight">
                    {venue.name}
                  </span>
                  {venue.city && (
                    <span className="font-mono text-[9px] text-neutral-500 uppercase">
                      {venue.city}
                    </span>
                  )}
                </div>
                <span className="font-mono text-xs text-[#8B5CF6] shrink-0 tabular-nums">
                  {venue.event_count}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
