"use client";

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { RefreshCw, ExternalLink, Search, X, ImageOff, Trash2, Share2 } from 'lucide-react';
import { EditEventModal, AdminEvent } from '@/components/admin/EditEventModal';
import WeeklyLineupModal from '@/components/admin/WeeklyLineupModal';
import { type StoryEvent } from '@/components/admin/generateWeeklyStory';

type Tab = 'pending' | 'live';

export default function AdminCMSPage() {
  const [password, setPassword] = useState('');
  const [isAuth, setIsAuth] = useState(false);

  const [tab, setTab] = useState<Tab>('pending');

  const [queue, setQueue] = useState<AdminEvent[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);

  const [liveEvents, setLiveEvents] = useState<AdminEvent[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [liveSearch, setLiveSearch] = useState('');

  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);
  const [editingMode, setEditingMode] = useState<Tab>('pending');

  const [showLineup, setShowLineup] = useState(false);

  // ── fetchers ──────────────────────────────────────────────────────────────

  const fetchQueue = async (pass: string) => {
    setLoadingQueue(true);
    try {
      const res = await fetch('/api/admin-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass, action: 'fetch' }),
      });
      if (res.ok) {
        const data = await res.json();
        setQueue(data.queue ?? []);
        setIsAuth(true);
      } else {
        alert('Wrong password!');
      }
    } finally {
      setLoadingQueue(false);
    }
  };

  const fetchLiveEvents = async (pass = password): Promise<AdminEvent[]> => {
    setLoadingLive(true);
    try {
      const res = await fetch('/api/admin/live-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass }),
      });
      if (res.ok) {
        const data = await res.json();
        const fetched: AdminEvent[] = data.events ?? [];
        setLiveEvents(fetched);
        setLiveLoaded(true);
        return fetched;
      }
      return [];
    } finally {
      setLoadingLive(false);
    }
  };

  // ── tab switching — lazy-loads live events on first open ──────────────────

  const handleTabChange = (t: Tab) => {
    setTab(t);
    if (t === 'live' && !liveLoaded) fetchLiveEvents();
  };

  // ── modal success / delete ────────────────────────────────────────────────

  const handleSuccess = (
    id: string,
    action: 'saved' | 'approved' | 'deleted',
    updatedFields?: Partial<AdminEvent>
  ) => {
    const removeFromCurrent = () => {
      if (editingMode === 'pending') setQueue(q => q.filter(e => e.id !== id));
      else setLiveEvents(evts => evts.filter(e => e.id !== id));
    };

    if (action === 'approved' || action === 'deleted') {
      removeFromCurrent();
    } else if (action === 'saved' && updatedFields) {
      if (editingMode === 'pending') {
        setQueue(q => q.map(e => (e.id === id ? { ...e, ...updatedFields } : e)));
      } else {
        setLiveEvents(evts => evts.map(e => (e.id === id ? { ...e, ...updatedFields } : e)));
      }
    }
  };

  // Delete called directly from table row (no modal open)
  const handleTableDelete = async (event: AdminEvent, source: Tab) => {
    if (!window.confirm(`Delete "${event.event_name}"?\n\nThis cannot be undone.`)) return;
    const table = source === 'pending' ? 'pending_events' : 'events';
    try {
      const res = await fetch('/api/admin/delete-event', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, table, id: event.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Delete failed: ${data.message}`);
        return;
      }
      if (source === 'pending') setQueue(q => q.filter(e => e.id !== event.id));
      else setLiveEvents(evts => evts.filter(e => e.id !== event.id));
    } catch {
      alert('Delete failed. Check your connection.');
    }
  };

  const openEdit = (event: AdminEvent, mode: Tab) => {
    setEditingEvent(event);
    setEditingMode(mode);
  };

  // ── filtered live events ──────────────────────────────────────────────────

  const needle = liveSearch.toLowerCase();
  const filteredLive = needle
    ? liveEvents.filter(
        e =>
          e.event_name.toLowerCase().includes(needle) ||
          e.club_name.toLowerCase().includes(needle) ||
          (e.dj_name ?? '').toLowerCase().includes(needle) ||
          (e.djs ?? []).some(d => d.toLowerCase().includes(needle))
      )
    : liveEvents;

  // ── auth gate ─────────────────────────────────────────────────────────────

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <div className="w-full max-w-sm border-2 border-neutral-700 bg-black p-8 shadow-[4px_4px_0px_rgba(0,229,255,0.5)]">
          <h1 className="text-white font-black text-2xl mb-1 uppercase">Admin CMS</h1>
          <p className="text-neutral-500 font-mono text-xs mb-6">Unified Queue &amp; Live Edit</p>
          <input
            type="password"
            placeholder="PASSWORD"
            className="w-full bg-[#1a1a1a] border-2 border-neutral-700 text-white p-3 font-mono mb-4 text-center focus:border-[#00E5FF] outline-none"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchQueue(password)}
            autoFocus
          />
          <button
            onClick={() => fetchQueue(password)}
            disabled={loadingQueue}
            className="w-full bg-[#00E5FF] text-black font-black p-3 uppercase hover:bg-[#76FF03] transition-colors disabled:opacity-50"
          >
            {loadingQueue ? 'LOADING...' : 'ENTER'}
          </button>
        </div>
      </div>
    );
  }

  // ── dashboard ─────────────────────────────────────────────────────────────

  const isLoading = tab === 'pending' ? loadingQueue : loadingLive;

  return (
    <>
      <div className="min-h-screen bg-[#121212] text-white p-4 md:p-8">
        <div className="max-w-6xl mx-auto">

          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h1 className="font-black text-3xl uppercase tracking-tighter text-[#00E5FF]">
              Admin CMS
            </h1>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={async () => {
                  if (!liveLoaded) await fetchLiveEvents();
                  setShowLineup(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-[#F53D04] text-white font-black text-xs uppercase tracking-widest hover:bg-[#FF5520] transition-colors"
                title="Curate and share this week's lineup as an Instagram Story"
              >
                <Share2 size={13} />
                Weekly Story
              </button>
              <button
                onClick={() => tab === 'pending' ? fetchQueue(password) : fetchLiveEvents()}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 border-2 border-neutral-700 font-mono text-sm hover:bg-neutral-800 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b-2 border-neutral-800 mb-6">
            <TabButton
              active={tab === 'pending'}
              onClick={() => handleTabChange('pending')}
              label="Pending Queue"
              count={queue.length}
            />
            <TabButton
              active={tab === 'live'}
              onClick={() => handleTabChange('live')}
              label="Live Events"
              count={liveLoaded ? liveEvents.length : null}
            />
          </div>

          {/* ── Pending Queue ─────────────────────────────────────────── */}
          {tab === 'pending' && (
            <EventTable
              events={queue}
              loading={loadingQueue}
              emptyMessage="Queue is empty. Go touch grass."
              showSource
              onEdit={e => openEdit(e, 'pending')}
              onDelete={e => handleTableDelete(e, 'pending')}
            />
          )}

          {/* ── Live Events ───────────────────────────────────────────── */}
          {tab === 'live' && (
            <div className="flex flex-col gap-4">
              <div className="relative max-w-sm">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Search by event, DJ or club..."
                  value={liveSearch}
                  onChange={e => setLiveSearch(e.target.value)}
                  className="w-full bg-[#1a1a1a] border-2 border-neutral-700 text-white pl-9 pr-9 py-2 font-mono text-sm focus:border-[#00E5FF] outline-none placeholder:text-neutral-600"
                />
                {liveSearch && (
                  <button
                    onClick={() => setLiveSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <EventTable
                events={filteredLive}
                loading={loadingLive}
                emptyMessage={
                  !liveLoaded
                    ? 'Loading...'
                    : liveSearch
                    ? 'No events match your search.'
                    : 'No upcoming live events found.'
                }
                showSource={false}
                onEdit={e => openEdit(e, 'live')}
                onDelete={e => handleTableDelete(e, 'live')}
              />
            </div>
          )}

        </div>
      </div>

      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          password={password}
          mode={editingMode}
          onClose={() => setEditingEvent(null)}
          onSuccess={(id, action, updatedFields) => {
            handleSuccess(id, action, updatedFields);
            setEditingEvent(null);
          }}
        />
      )}

      <AnimatePresence>
        {showLineup && (
          <WeeklyLineupModal
            events={liveEvents as StoryEvent[]}
            darkMode={true}
            onClose={() => setShowLineup(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function TabButton({
  active, onClick, label, count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number | null;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 font-black text-xs uppercase tracking-widest transition-colors border-b-2 -mb-0.5 ${
        active
          ? 'text-[#00E5FF] border-[#00E5FF]'
          : 'text-neutral-500 border-transparent hover:text-neutral-300'
      }`}
    >
      {label}
      {count !== null && (
        <span className={`ml-2 px-1.5 py-0.5 text-[9px] font-black rounded-none ${
          active ? 'bg-[#00E5FF]/10 text-[#00E5FF]' : 'bg-neutral-800 text-neutral-500'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function EventTable({
  events, loading, emptyMessage, showSource, onEdit, onDelete,
}: {
  events: AdminEvent[];
  loading: boolean;
  emptyMessage: string;
  showSource: boolean;
  onEdit: (e: AdminEvent) => void;
  onDelete: (e: AdminEvent) => void;
}) {
  if (loading && events.length === 0) {
    return (
      <div className="text-center py-16 font-mono text-neutral-500 text-sm animate-pulse">
        Loading...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-24 font-mono">
        <p className="text-neutral-400 text-base">{emptyMessage}</p>
      </div>
    );
  }

  const cols = showSource
    ? ['Poster', 'Event', 'DJs', 'Date', 'Venue', 'Source', '']
    : ['Poster', 'Event', 'DJs', 'Date', 'Venue', ''];

  return (
    <div className="overflow-x-auto border-2 border-neutral-700">
      <table className="w-full min-w-[860px] border-collapse">
        <thead>
          <tr className="bg-neutral-900 border-b border-neutral-700">
            {cols.map(h => (
              <th
                key={h}
                className="text-left px-4 py-2 text-[10px] font-mono text-neutral-500 uppercase tracking-widest font-normal whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((event, i) => (
            <tr
              key={event.id}
              className={`border-b border-neutral-800 last:border-0 ${
                i % 2 === 0 ? 'bg-[#111]' : 'bg-[#0d0d0d]'
              }`}
            >
              {/* Poster thumbnail — larger so text is legible */}
              <td className="pl-3 pr-2 py-2 w-[108px]">
                <div className="w-24 h-[128px] overflow-hidden border border-neutral-700 bg-neutral-900 shrink-0">
                  {event.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.image_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-700">
                      <ImageOff size={18} />
                    </div>
                  )}
                </div>
              </td>

              <td className="px-4 py-2 max-w-[200px]">
                <p className="font-black text-sm text-white truncate">{event.event_name}</p>
              </td>
              <td className="px-4 py-2 max-w-[160px]">
                <p className="font-mono text-xs text-neutral-400 truncate">
                  {event.dj_name || event.djs?.join(', ') || '—'}
                </p>
              </td>
              <td className="px-4 py-2 whitespace-nowrap">
                <span className="font-mono text-xs text-neutral-300">{event.event_date}</span>
              </td>
              <td className="px-4 py-2 max-w-[160px]">
                <span className="font-mono text-xs text-neutral-300 truncate block">
                  {event.club_name}
                </span>
              </td>
              {showSource && (
                <td className="px-4 py-2 whitespace-nowrap">
                  <SourceBadge source={event.source} />
                </td>
              )}
              <td className="px-4 py-2 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  {event.ig_post_url && (
                    <a
                      href={event.ig_post_url.split('#')[0]}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 border border-neutral-700 text-neutral-500 hover:text-white hover:border-neutral-500 transition-colors"
                      title="View IG Post"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                  <button
                    onClick={() => onEdit(event)}
                    className="px-3 py-1.5 border-2 border-neutral-600 text-xs font-black uppercase hover:border-[#00E5FF] hover:text-[#00E5FF] transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(event)}
                    className="p-1.5 border border-neutral-700 text-neutral-600 hover:border-[#FF3D00] hover:text-[#FF3D00] transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceBadge({ source }: { source: string | null }) {
  if (source === 'scraper') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black font-mono uppercase bg-blue-950 border border-blue-700 text-blue-300">
        🤖 AI
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black font-mono uppercase bg-green-950 border border-green-700 text-green-300">
      👤 User
    </span>
  );
}
