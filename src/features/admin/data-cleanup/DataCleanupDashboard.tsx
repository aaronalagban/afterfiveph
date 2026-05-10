'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, Check, X, AlertTriangle, ImageOff,
  Instagram, ChevronDown, Search, Trash2, Users, MapPin,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type CleanupTab = 'artists' | 'venues' | 'events' | 'duplicates';
type SimilarityReason = 'case_duplicate' | 'substring_match' | 'trigram_similar';
type ArtistSort = 'events_desc' | 'events_asc' | 'az' | 'za' | 'duplicates';
type VenueSort  = 'events_desc' | 'events_asc' | 'az' | 'za' | 'recent' | 'duplicates';
type EventSort  = 'date_asc'    | 'date_desc'   | 'az';

interface ArtistTask {
  id: string;
  name: string;
  ig_handle: string | null;
  event_count: number;
}

interface VenueTask {
  id: string;
  name: string;
  city: string;
  ig_handle: string | null;
  address: string | null;
  google_maps_url: string | null;
  event_count: number;
  created_at: string | null;
}

interface OrphanedEvent {
  id: number;
  event_name: string | null;
  event_date: string;
  image_url: string;
  club_name: string;
  city: string;
  dj_name: string;
  djs: string[];
  venue_id: string | null;
}

interface VenueOption  { id: string; name: string; city: string; }
interface ArtistOption { id: string; name: string; ig_handle: string | null; }

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface SuggestionMember {
  id: string;
  name: string;
  secondary?: string | null;
}

interface SuggestionGroup {
  id: string;
  type: 'artist' | 'venue';
  reason: SimilarityReason;
  confidence: number;
  members: SuggestionMember[];
}

// ─── API helper ───────────────────────────────────────────────────────────────

async function api(password: string, action: string, payload?: object) {
  const res = await fetch('/api/admin/cleanup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, action, payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? 'Request failed');
  return data;
}

// ─── Duplicate scoring ────────────────────────────────────────────────────────

function dupeScore(name: string, allNames: string[]): number {
  const norm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  let score = 0;
  for (const other of allNames) {
    const o = other.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (o === norm) continue;
    if (norm.length >= 4 && o.length >= 4 && o.startsWith(norm.slice(0, 4))) score += 2;
    else if (norm.length >= 3 && o.includes(norm.slice(0, 3))) score += 1;
  }
  return score;
}

// ─── CleanupTabContent — embeddable (named export) ────────────────────────────

export function CleanupTabContent({ password }: { password: string }) {
  const [tab,           setTab]          = useState<CleanupTab>('artists');
  const [artists,       setArtists]      = useState<ArtistTask[]>([]);
  const [venues,        setVenues]       = useState<VenueTask[]>([]);
  const [orphaned,      setOrphaned]     = useState<OrphanedEvent[]>([]);
  const [suggestions,   setSuggestions]  = useState<SuggestionGroup[]>([]);
  const [allVenues,     setAllVenues]    = useState<VenueOption[]>([]);
  const [allArtists,    setAllArtists]   = useState<ArtistOption[]>([]);
  const [loadingTab,    setLoadingTab]   = useState(false);
  const [loadingDupes,  setLoadingDupes] = useState(false);
  const [toasts,        setToasts]       = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastItem['type']) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  const loadSuggestions = useCallback(async () => {
    setLoadingDupes(true);
    try {
      const { data } = await api(password, 'fetch_suggestions');
      setSuggestions(data ?? []);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to load suggestions', 'error');
    } finally {
      setLoadingDupes(false);
    }
  }, [password]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = useCallback(async (t: CleanupTab) => {
    setLoadingTab(true);
    try {
      if (t === 'artists') {
        const { data } = await api(password, 'fetch_artists');
        setArtists(data ?? []);
      } else if (t === 'venues') {
        const { data } = await api(password, 'fetch_venues');
        setVenues(data ?? []);
      } else {
        const { data } = await api(password, 'fetch_orphaned');
        setOrphaned(data ?? []);
      }
    } finally {
      setLoadingTab(false);
    }
  }, [password]);

  // Load initial tab + reference data on mount
  useEffect(() => {
    loadData('artists');
    api(password, 'fetch_all_venues').then(r  => setAllVenues(r.data ?? []));
    api(password, 'fetch_all_artists').then(r => setAllArtists(r.data ?? []));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const switchTab = (t: CleanupTab) => {
    setTab(t);
    if (t === 'duplicates') loadSuggestions();
    else loadData(t);
  };

  const tabCount = {
    artists: artists.length,
    venues: venues.length,
    events: orphaned.length,
    duplicates: suggestions.length,
  };

  return (
    <>
      <div>
        {/* Sub-tab bar + refresh */}
        <div className="flex items-center justify-between border-b-2 border-neutral-800 mb-6">
          <div className="flex">
            {(
            [
              { id: 'artists',    label: 'Artists' },
              { id: 'venues',     label: 'Venues' },
              { id: 'events',     label: 'Orphaned Events' },
              { id: 'duplicates', label: 'Duplicates' },
            ] as { id: CleanupTab; label: string }[]
          ).map(t => (
            <CleanupTabButton
              key={t.id}
              active={tab === t.id}
              onClick={() => switchTab(t.id)}
              label={t.label}
              count={tabCount[t.id]}
            />
          ))}
          </div>
          <button
            onClick={() => tab === 'duplicates' ? loadSuggestions() : loadData(tab)}
            disabled={tab === 'duplicates' ? loadingDupes : loadingTab}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-700 font-mono text-[10px] uppercase hover:bg-neutral-800 disabled:opacity-50 transition-colors text-neutral-400 mb-0.5"
          >
            <RefreshCw size={10} className={(tab === 'duplicates' ? loadingDupes : loadingTab) ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {tab === 'artists' && (
            <motion.div key="artists" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ArtistsTab
                items={artists}
                loading={loadingTab && artists.length === 0}
                password={password}
                onRemove={id => setArtists(a => a.filter(x => x.id !== id))}
                onRestore={item => setArtists(a => [item, ...a])}
                onToast={addToast}
              />
            </motion.div>
          )}
          {tab === 'venues' && (
            <motion.div key="venues" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <VenuesTab
                items={venues}
                loading={loadingTab && venues.length === 0}
                password={password}
                onRemove={id => setVenues(v => v.filter(x => x.id !== id))}
                onRestore={item => setVenues(v => [item, ...v])}
                onToast={addToast}
              />
            </motion.div>
          )}
          {tab === 'events' && (
            <motion.div key="events" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <OrphanedEventsTab
                items={orphaned}
                loading={loadingTab && orphaned.length === 0}
                password={password}
                allVenues={allVenues}
                allArtists={allArtists}
                onRemove={id => setOrphaned(o => o.filter(x => x.id !== id))}
                onRestore={item => setOrphaned(o => [item, ...o])}
                onToast={addToast}
              />
            </motion.div>
          )}
          {tab === 'duplicates' && (
            <motion.div key="duplicates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SuggestionsTab
                items={suggestions}
                loading={loadingDupes}
                password={password}
                onResolved={id => setSuggestions(s => s.filter(g => g.id !== id))}
                onToast={addToast}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast stack */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(t => <Toast key={t.id} toast={t} />)}
        </AnimatePresence>
      </div>
    </>
  );
}

// ─── DataCleanupDashboard — standalone with auth (default export) ─────────────

export default function DataCleanupDashboard() {
  const [password, setPassword] = useState('');
  const [isAuth,   setIsAuth]   = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const handleAuth = async (pass: string) => {
    setAuthBusy(true);
    try {
      await api(pass, 'fetch_artists');
      setIsAuth(true);
      setPassword(pass);
    } catch {
      alert('Wrong password.');
    } finally {
      setAuthBusy(false);
    }
  };

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <div className="w-full max-w-sm border-2 border-neutral-700 bg-black p-8 shadow-[4px_4px_0px_rgba(0,229,255,0.15)]">
          <h1 className="text-white font-black text-2xl mb-6 uppercase tracking-tighter">
            Data Cleanup
          </h1>
          <input
            type="password"
            placeholder="PASSWORD"
            className="w-full bg-[#1a1a1a] border-2 border-neutral-700 text-white p-3 font-mono mb-4 text-center focus:border-[#00E5FF] outline-none"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth(password)}
            autoFocus
          />
          <button
            onClick={() => handleAuth(password)}
            disabled={authBusy || !password}
            className="w-full bg-[#00E5FF] text-black font-black p-3 uppercase hover:bg-white transition-colors disabled:opacity-50"
          >
            {authBusy ? 'CHECKING...' : 'ENTER'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="font-black text-3xl uppercase tracking-tighter text-[#00E5FF]">
            Data Cleanup
          </h1>
          <p className="font-mono text-xs text-neutral-500 mt-1 uppercase">
            Enrich missing handles · Reassign orphaned events
          </p>
        </div>
        <CleanupTabContent password={password} />
      </div>
    </div>
  );
}

// ─── Tab 0: Duplicates ────────────────────────────────────────────────────────

function ReasonBadge({ reason }: { reason: SimilarityReason }) {
  const MAP: Record<SimilarityReason, { label: string; cls: string }> = {
    case_duplicate: { label: 'Case Duplicate', cls: 'text-[#FF3D00] border-[#FF3D00]/30 bg-[#FF3D00]/5' },
    substring_match:{ label: 'Name Overlap',   cls: 'text-[#F59E0B] border-[#F59E0B]/30 bg-[#F59E0B]/5' },
    trigram_similar:{ label: 'Similar Name',   cls: 'text-[#00E5FF] border-[#00E5FF]/30 bg-[#00E5FF]/5' },
  };
  const { label, cls } = MAP[reason];
  return (
    <span className={`font-mono text-[9px] uppercase tracking-widest border px-2 py-0.5 ${cls}`}>
      {label}
    </span>
  );
}

function SuggestionCard({
  group, password, onResolved, onToast,
}: {
  group: SuggestionGroup;
  password: string;
  onResolved: (id: string) => void;
  onToast: (msg: string, type: ToastItem['type']) => void;
}) {
  const [primaryId, setPrimaryId] = useState(group.members[0].id);
  const [mode, setMode]           = useState<'idle' | 'merging' | 'confirm-delete'>('idle');
  const [busy, setBusy]           = useState(false);

  async function call(action: 'merge_entities' | 'delete_entities' | 'dismiss_suggestion') {
    setBusy(true);
    try {
      await api(password, action, {
        type: group.type,
        primaryId: action === 'merge_entities' ? primaryId : undefined,
        memberIds: group.members.map(m => m.id),
      });
      onToast(
        action === 'merge_entities'   ? `Merged ${group.members.length - 1} duplicate${group.members.length > 2 ? 's' : ''}` :
        action === 'delete_entities'  ? `Deleted ${group.members.length} records` :
        'Group dismissed',
        'success'
      );
      onResolved(group.id);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Request failed', 'error');
      setBusy(false);
    }
  }

  const Icon = group.type === 'artist' ? Users : MapPin;
  const typeColor = group.type === 'artist' ? 'text-[#76FF03]' : 'text-[#00E5FF]';

  const reasonDesc: Record<SimilarityReason, string> = {
    case_duplicate: 'Identical names, different capitalisation:',
    substring_match: 'One name contains the other — likely the same entity:',
    trigram_similar: 'High character similarity — possible duplicates:',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="border border-neutral-800 bg-[#111] hover:border-neutral-700 transition-colors"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-3 border-b border-neutral-800/60">
        <span className={`flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest ${typeColor}`}>
          <Icon size={11} />{group.type}
        </span>
        <ReasonBadge reason={group.reason} />
        <span className="font-mono text-[9px] text-neutral-500">
          {Math.round(group.confidence * 100)}% match
        </span>
        <span className="ml-auto font-mono text-[9px] text-neutral-600">
          {group.members.length} records
        </span>
      </div>

      {/* Member list */}
      <div className="px-4 py-3 space-y-1.5">
        <p className="font-mono text-[10px] text-neutral-500 mb-3 uppercase tracking-wider">
          {reasonDesc[group.reason]}
        </p>
        {group.members.map(m => (
          <button
            key={m.id}
            onClick={() => mode === 'merging' && setPrimaryId(m.id)}
            disabled={mode !== 'merging'}
            className={`w-full flex items-center gap-3 px-3 py-2.5 border text-left transition-colors disabled:cursor-default ${
              mode === 'merging'
                ? primaryId === m.id
                  ? 'border-[#76FF03]/60 bg-[#76FF03]/5'
                  : 'border-neutral-700 hover:border-neutral-500'
                : 'border-neutral-800'
            }`}
          >
            {mode === 'merging' && (
              <div className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 flex items-center justify-center ${
                primaryId === m.id ? 'border-[#76FF03] bg-[#76FF03]' : 'border-neutral-600'
              }`}>
                {primaryId === m.id && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
              </div>
            )}
            <span className="text-white font-black text-sm flex-1 leading-none">
              {m.name}
            </span>
            {m.secondary && (
              <span className="font-mono text-[10px] text-neutral-500">{m.secondary}</span>
            )}
            {mode === 'merging' && primaryId === m.id && (
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#76FF03]">Primary</span>
            )}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4">
        {mode === 'idle' && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setMode('merging')}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#76FF03]/10 border border-[#76FF03]/30 text-[#76FF03] font-black text-[10px] uppercase tracking-widest hover:bg-[#76FF03]/20 transition-colors"
            >
              <Check size={11} /> Merge
            </button>
            <button
              onClick={() => call('dismiss_suggestion')}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 border border-neutral-800 text-neutral-400 font-mono text-[10px] uppercase tracking-widest hover:border-neutral-600 hover:text-neutral-300 disabled:opacity-50 transition-colors"
            >
              <X size={11} /> Keep Separate
            </button>
            <button
              onClick={() => setMode('confirm-delete')}
              className="flex items-center gap-1.5 px-3 py-2 border border-[#FF3D00]/20 text-[#FF3D00]/60 font-mono text-[10px] uppercase tracking-widest hover:border-[#FF3D00]/50 hover:text-[#FF3D00] transition-colors"
            >
              <Trash2 size={11} /> Delete All
            </button>
          </div>
        )}

        {mode === 'merging' && (
          <div className="space-y-2">
            <p className="font-mono text-[10px] text-neutral-500">
              Select the <span className="text-white">canonical record</span> above.
              Duplicates will be deleted and their event links transferred.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => call('merge_entities')}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#76FF03] text-black font-black text-[10px] uppercase tracking-widest hover:bg-white disabled:opacity-50 transition-colors"
              >
                {busy ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                Apply Merge
              </button>
              <button
                onClick={() => setMode('idle')}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-2 border border-neutral-800 text-neutral-400 font-mono text-[10px] uppercase tracking-widest hover:border-neutral-600 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {mode === 'confirm-delete' && (
          <div className="space-y-2">
            <p className="font-mono text-[10px] text-[#FF3D00]">
              Permanently delete all {group.members.length} records?
              Event links will be removed (artists) or cleared (venues).
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => call('delete_entities')}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#FF3D00] text-white font-black text-[10px] uppercase tracking-widest hover:bg-red-400 disabled:opacity-50 transition-colors"
              >
                {busy ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
                Confirm Delete
              </button>
              <button
                onClick={() => setMode('idle')}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-2 border border-neutral-800 text-neutral-400 font-mono text-[10px] uppercase tracking-widest hover:border-neutral-600 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SuggestionsTab({
  items, loading, password, onResolved, onToast,
}: {
  items: SuggestionGroup[];
  loading: boolean;
  password: string;
  onResolved: (id: string) => void;
  onToast: (msg: string, type: ToastItem['type']) => void;
}) {
  const artists = items.filter(g => g.type === 'artist');
  const venues  = items.filter(g => g.type === 'venue');

  if (loading) return <Spinner />;

  if (!items.length) {
    return (
      <EmptyState message="No duplicates detected. Your artist and venue records look clean." />
    );
  }

  return (
    <div className="space-y-8">
      <p className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest">
        {items.length} duplicate group{items.length !== 1 ? 's' : ''} detected via name similarity analysis.
        Dismissed groups won&apos;t reappear.
      </p>

      {artists.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Users size={12} className="text-[#76FF03]" />
            <span className="font-black text-[10px] uppercase tracking-widest text-[#76FF03]">
              Artists — {artists.length} group{artists.length !== 1 ? 's' : ''}
            </span>
          </div>
          <AnimatePresence initial={false}>
            {artists.map(g => (
              <SuggestionCard
                key={g.id}
                group={g}
                password={password}
                onResolved={onResolved}
                onToast={onToast}
              />
            ))}
          </AnimatePresence>
        </section>
      )}

      {venues.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={12} className="text-[#00E5FF]" />
            <span className="font-black text-[10px] uppercase tracking-widest text-[#00E5FF]">
              Venues — {venues.length} group{venues.length !== 1 ? 's' : ''}
            </span>
          </div>
          <AnimatePresence initial={false}>
            {venues.map(g => (
              <SuggestionCard
                key={g.id}
                group={g}
                password={password}
                onResolved={onResolved}
                onToast={onToast}
              />
            ))}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}

// ─── Tab 1: Artists ───────────────────────────────────────────────────────────

function ArtistsTab({
  items, loading, password, onRemove, onRestore, onToast,
}: {
  items: ArtistTask[];
  loading: boolean;
  password: string;
  onRemove: (id: string) => void;
  onRestore: (item: ArtistTask) => void;
  onToast: (msg: string, type: ToastItem['type']) => void;
}) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<ArtistSort>('events_desc');

  const displayItems = useMemo(() => {
    const allNames = items.map(a => a.name);
    let list = search.trim()
      ? items.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
      : items;

    switch (sortBy) {
      case 'events_asc':  return [...list].sort((a, b) => a.event_count - b.event_count);
      case 'az':          return [...list].sort((a, b) => a.name.localeCompare(b.name));
      case 'za':          return [...list].sort((a, b) => b.name.localeCompare(a.name));
      case 'duplicates': {
        const scores = new Map(items.map(i => [i.id, dupeScore(i.name, allNames)]));
        return [...list].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
      }
      default:            return [...list].sort((a, b) => b.event_count - a.event_count);
    }
  }, [items, search, sortBy]);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search artists…" />
        <SortSelect<ArtistSort>
          value={sortBy}
          onChange={setSortBy}
          options={[
            { value: 'events_desc', label: 'Events: Most' },
            { value: 'events_asc',  label: 'Events: Least' },
            { value: 'az',          label: 'A → Z' },
            { value: 'za',          label: 'Z → A' },
            { value: 'duplicates',  label: 'Duplicates First' },
          ]}
        />
        <span className="font-mono text-[10px] text-neutral-600 whitespace-nowrap">
          {displayItems.length}{search ? ` / ${items.length}` : ''}&nbsp;artist{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {!items.length ? (
        <EmptyState message="All artists have Instagram handles. Nothing to do here." />
      ) : !displayItems.length ? (
        <EmptyState message="No artists match your search." />
      ) : (
        <div className="space-y-px">
          <AnimatePresence initial={false}>
            {displayItems.map(item => (
              <ArtistRow
                key={item.id}
                item={item}
                password={password}
                onRemove={onRemove}
                onRestore={onRestore}
                onToast={onToast}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function ArtistRow({
  item, password, onRemove, onRestore, onToast,
}: {
  item: ArtistTask;
  password: string;
  onRemove: (id: string) => void;
  onRestore: (item: ArtistTask) => void;
  onToast: (msg: string, type: ToastItem['type']) => void;
}) {
  const [handle, setHandle] = useState('');
  const [busy,   setBusy]   = useState(false);

  const save = async () => {
    const clean = handle.trim().replace(/^@/, '');
    if (!clean) return;
    setBusy(true);
    onRemove(item.id);
    try {
      await api(password, 'update_artist', { id: item.id, ig_handle: clean });
      onToast(`@${clean} linked to ${item.name}`, 'success');
    } catch (err) {
      onRestore(item);
      onToast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="flex items-center gap-3 px-4 py-3 bg-[#111] border border-neutral-800 hover:border-neutral-700 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="font-black text-sm text-white truncate">{item.name}</p>
        <p className="font-mono text-[10px] text-neutral-500 mt-0.5">
          {item.event_count}&nbsp;EVENT{item.event_count !== 1 ? 'S' : ''}
        </p>
      </div>

      <a
        href={`https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(item.name)}`}
        target="_blank"
        rel="noreferrer"
        title="Search on Instagram"
        className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 border border-neutral-700 text-neutral-500 hover:border-pink-600 hover:text-pink-400 transition-colors font-mono text-[10px] uppercase"
      >
        <Instagram size={11} />
        IG
      </a>

      <div className="flex items-center border border-neutral-700 focus-within:border-[#00E5FF] transition-colors">
        <span className="px-2 py-2 font-mono text-xs text-neutral-600 border-r border-neutral-700 bg-[#0d0d0d] select-none">@</span>
        <input
          type="text"
          value={handle}
          onChange={e => setHandle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="handle"
          className="w-36 bg-transparent text-white font-mono text-xs px-2 py-2 outline-none placeholder:text-neutral-600"
        />
      </div>

      <button
        onClick={save}
        disabled={busy || !handle.trim()}
        className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-[#00E5FF] text-black font-black text-xs uppercase hover:bg-white transition-colors disabled:opacity-40"
      >
        {busy ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
        SAVE
      </button>
    </motion.div>
  );
}

// ─── Tab 2: Venues ────────────────────────────────────────────────────────────

function VenuesTab({
  items, loading, password, onRemove, onRestore, onToast,
}: {
  items: VenueTask[];
  loading: boolean;
  password: string;
  onRemove: (id: string) => void;
  onRestore: (item: VenueTask) => void;
  onToast: (msg: string, type: ToastItem['type']) => void;
}) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<VenueSort>('events_desc');

  const displayItems = useMemo(() => {
    const allNames = items.map(v => v.name);
    let list = search.trim()
      ? items.filter(v =>
          v.name.toLowerCase().includes(search.toLowerCase()) ||
          v.city.toLowerCase().includes(search.toLowerCase())
        )
      : items;

    switch (sortBy) {
      case 'events_asc':  return [...list].sort((a, b) => a.event_count - b.event_count);
      case 'az':          return [...list].sort((a, b) => a.name.localeCompare(b.name));
      case 'za':          return [...list].sort((a, b) => b.name.localeCompare(a.name));
      case 'recent':      return [...list].sort((a, b) => {
        const dA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dB - dA;
      });
      case 'duplicates': {
        const scores = new Map(items.map(i => [i.id, dupeScore(i.name, allNames)]));
        return [...list].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
      }
      default:            return [...list].sort((a, b) => b.event_count - a.event_count);
    }
  }, [items, search, sortBy]);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search venues…" />
        <SortSelect<VenueSort>
          value={sortBy}
          onChange={setSortBy}
          options={[
            { value: 'events_desc', label: 'Events: Most' },
            { value: 'events_asc',  label: 'Events: Least' },
            { value: 'az',          label: 'A → Z' },
            { value: 'za',          label: 'Z → A' },
            { value: 'recent',      label: 'Recently Added' },
            { value: 'duplicates',  label: 'Duplicates First' },
          ]}
        />
        <span className="font-mono text-[10px] text-neutral-600 whitespace-nowrap">
          {displayItems.length}{search ? ` / ${items.length}` : ''}&nbsp;venue{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {!items.length ? (
        <EmptyState message="All venues are fully enriched. Nothing to do here." />
      ) : !displayItems.length ? (
        <EmptyState message="No venues match your search." />
      ) : (
        <div className="space-y-px">
          <AnimatePresence initial={false}>
            {displayItems.map(item => (
              <VenueRow
                key={item.id}
                item={item}
                password={password}
                onRemove={onRemove}
                onRestore={onRestore}
                onToast={onToast}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function VenueRow({
  item, password, onRemove, onRestore, onToast,
}: {
  item: VenueTask;
  password: string;
  onRemove: (id: string) => void;
  onRestore: (item: VenueTask) => void;
  onToast: (msg: string, type: ToastItem['type']) => void;
}) {
  const [fields, setFields] = useState({
    ig_handle:       item.ig_handle       ?? '',
    address:         item.address         ?? '',
    google_maps_url: item.google_maps_url ?? '',
  });
  const [expanded, setExpanded] = useState(false);
  const [busy,     setBusy]     = useState(false);

  const set = (key: keyof typeof fields) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields(f => ({ ...f, [key]: e.target.value }));

  const isDirty =
    fields.ig_handle       !== (item.ig_handle       ?? '') ||
    fields.address         !== (item.address         ?? '') ||
    fields.google_maps_url !== (item.google_maps_url ?? '');

  const allGapsNowFilled =
    (!!item.ig_handle || !!fields.ig_handle.trim()) &&
    (!!item.address   || !!fields.address.trim());

  const save = async () => {
    setBusy(true);
    if (allGapsNowFilled) onRemove(item.id);

    const patch: Record<string, string | null> = {};
    if (fields.ig_handle       !== (item.ig_handle       ?? ''))
      patch.ig_handle       = fields.ig_handle.trim().replace(/^@/, '') || null;
    if (fields.address         !== (item.address         ?? ''))
      patch.address         = fields.address.trim() || null;
    if (fields.google_maps_url !== (item.google_maps_url ?? ''))
      patch.google_maps_url = fields.google_maps_url.trim() || null;

    try {
      await api(password, 'update_venue', { id: item.id, fields: patch });
      onToast(`${item.name} updated`, 'success');
    } catch (err) {
      if (allGapsNowFilled) onRestore(item);
      onToast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="bg-[#111] border border-neutral-800 hover:border-neutral-700 transition-colors"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm text-white truncate">{item.name}</p>
          <p className="font-mono text-[10px] text-neutral-500 mt-0.5 flex flex-wrap gap-x-3">
            <span>{item.city}</span>
            <span>{item.event_count}&nbsp;EVENT{item.event_count !== 1 ? 'S' : ''}</span>
            {!item.ig_handle && <span className="text-amber-500">· NO HANDLE</span>}
            {!item.address   && <span className="text-amber-500">· NO ADDRESS</span>}
          </p>
        </div>

        <a
          href={`https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(item.name)}`}
          target="_blank"
          rel="noreferrer"
          title="Search on Instagram"
          className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 border border-neutral-700 text-neutral-500 hover:border-pink-600 hover:text-pink-400 transition-colors font-mono text-[10px] uppercase"
        >
          <Instagram size={11} />
          IG
        </a>

        <div className="flex items-center border border-neutral-700 focus-within:border-[#00E5FF] transition-colors">
          <span className="px-2 py-2 font-mono text-xs text-neutral-600 border-r border-neutral-700 bg-[#0d0d0d] select-none">@</span>
          <input
            type="text"
            value={fields.ig_handle}
            onChange={set('ig_handle')}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="handle"
            className="w-28 bg-transparent text-white font-mono text-xs px-2 py-2 outline-none placeholder:text-neutral-600"
          />
        </div>

        <button
          onClick={() => setExpanded(x => !x)}
          title="More fields"
          className="p-2 border border-neutral-700 text-neutral-500 hover:text-white hover:border-neutral-500 transition-colors"
        >
          <ChevronDown
            size={13}
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>

        <button
          onClick={save}
          disabled={busy || !isDirty}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-[#00E5FF] text-black font-black text-xs uppercase hover:bg-white transition-colors disabled:opacity-40"
        >
          {busy ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
          SAVE
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-neutral-800"
          >
            <div className="flex gap-4 p-4">
              <label className="flex-1 flex flex-col gap-1">
                <span className="font-mono text-[9px] text-neutral-500 uppercase">Address</span>
                <input
                  type="text"
                  value={fields.address}
                  onChange={set('address')}
                  placeholder="123 Kalayaan Ave, Makati"
                  className="bg-[#0d0d0d] border border-neutral-700 text-white font-mono text-xs px-3 py-2 outline-none focus:border-[#00E5FF] placeholder:text-neutral-600 transition-colors"
                />
              </label>
              <label className="flex-1 flex flex-col gap-1">
                <span className="font-mono text-[9px] text-neutral-500 uppercase">Google Maps URL</span>
                <input
                  type="text"
                  value={fields.google_maps_url}
                  onChange={set('google_maps_url')}
                  placeholder="https://maps.google.com/…"
                  className="bg-[#0d0d0d] border border-neutral-700 text-white font-mono text-xs px-3 py-2 outline-none focus:border-[#00E5FF] placeholder:text-neutral-600 transition-colors"
                />
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Tab 3: Orphaned Events ───────────────────────────────────────────────────

function OrphanedEventsTab({
  items, loading, password, allVenues, allArtists, onRemove, onRestore, onToast,
}: {
  items: OrphanedEvent[];
  loading: boolean;
  password: string;
  allVenues: VenueOption[];
  allArtists: ArtistOption[];
  onRemove: (id: number) => void;
  onRestore: (item: OrphanedEvent) => void;
  onToast: (msg: string, type: ToastItem['type']) => void;
}) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<EventSort>('date_asc');

  const displayItems = useMemo(() => {
    let list = search.trim()
      ? items.filter(e =>
          (e.event_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
          e.club_name.toLowerCase().includes(search.toLowerCase()) ||
          (e.djs ?? []).some(d => d.toLowerCase().includes(search.toLowerCase())) ||
          (e.dj_name ?? '').toLowerCase().includes(search.toLowerCase())
        )
      : items;

    switch (sortBy) {
      case 'date_desc': return [...list].sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
      case 'az':        return [...list].sort((a, b) => (a.event_name ?? '').localeCompare(b.event_name ?? ''));
      default:          return [...list].sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    }
  }, [items, search, sortBy]);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search events, venues, DJs…" />
        <SortSelect<EventSort>
          value={sortBy}
          onChange={setSortBy}
          options={[
            { value: 'date_asc',  label: 'Date: Oldest' },
            { value: 'date_desc', label: 'Date: Newest' },
            { value: 'az',        label: 'A → Z' },
          ]}
        />
        <span className="font-mono text-[10px] text-neutral-600 whitespace-nowrap">
          {displayItems.length}{search ? ` / ${items.length}` : ''}&nbsp;event{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {!items.length ? (
        <EmptyState message="No orphaned events found. Every event has a venue and artists." />
      ) : !displayItems.length ? (
        <EmptyState message="No events match your search." />
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {displayItems.map(item => (
              <OrphanedEventCard
                key={item.id}
                item={item}
                password={password}
                allVenues={allVenues}
                allArtists={allArtists}
                onRemove={onRemove}
                onRestore={onRestore}
                onToast={onToast}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function OrphanedEventCard({
  item, password, allVenues, allArtists, onRemove, onRestore, onToast,
}: {
  item: OrphanedEvent;
  password: string;
  allVenues: VenueOption[];
  allArtists: ArtistOption[];
  onRemove: (id: number) => void;
  onRestore: (item: OrphanedEvent) => void;
  onToast: (msg: string, type: ToastItem['type']) => void;
}) {
  const [venueId,   setVenueId]   = useState<string | null>(item.venue_id);
  const [artistIds, setArtistIds] = useState<string[]>([]);
  const [busy,      setBusy]      = useState(false);

  const isVenueDirty  = venueId !== item.venue_id;
  const isArtistDirty = artistIds.length > 0;
  const canSave       = isVenueDirty || isArtistDirty;

  const djLabel = item.djs?.length ? item.djs.join(', ') : item.dj_name || '—';

  const save = async () => {
    setBusy(true);
    onRemove(item.id);

    const payload: Record<string, unknown> = { event_id: item.id };
    if (isVenueDirty)  payload.venue_id   = venueId;
    if (isArtistDirty) payload.artist_ids = artistIds;

    try {
      await api(password, 'reassign_event', payload);
      onToast(`"${item.event_name ?? 'Event'}" reassigned`, 'success');
    } catch (err) {
      onRestore(item);
      onToast(err instanceof Error ? err.message : 'Reassign failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="flex gap-4 p-4 bg-[#111] border border-neutral-800"
    >
      <div className="w-[72px] h-24 shrink-0 border border-neutral-700 bg-neutral-900 overflow-hidden">
        {item.image_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={item.image_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          : <div className="w-full h-full flex items-center justify-center text-neutral-700"><ImageOff size={18} /></div>
        }
      </div>

      <div className="w-52 shrink-0 flex flex-col justify-center gap-1">
        <p className="font-black text-sm text-white leading-tight line-clamp-2">
          {item.event_name ?? 'Untitled Event'}
        </p>
        <p className="font-mono text-[10px] text-neutral-400 uppercase">
          {new Date(item.event_date + 'T00:00:00').toLocaleDateString('en-PH', {
            weekday: 'short', month: 'short', day: 'numeric',
          })}
        </p>
        <div className="mt-1 space-y-0.5">
          <DataTag label="CLUB" value={item.club_name ?? '—'} missing={!item.venue_id} />
          <DataTag label="DJs"  value={djLabel}               missing={!item.djs?.length && !item.dj_name} />
        </div>
      </div>

      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[9px] text-neutral-500 uppercase">
            {!item.venue_id && <span className="text-amber-500">⚠ </span>}Venue
          </span>
          <ComboBox
            options={allVenues.map(v => ({ id: v.id, label: v.name, sublabel: v.city }))}
            value={venueId}
            onChange={setVenueId}
            placeholder="Select venue…"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[9px] text-neutral-500 uppercase">
            {item.djs?.length === 0 && <span className="text-amber-500">⚠ </span>}Artists
          </span>
          <MultiComboBox
            options={allArtists.map(a => ({ id: a.id, label: a.name }))}
            value={artistIds}
            onChange={setArtistIds}
            placeholder="Select artists…"
          />
        </div>

        <button
          onClick={save}
          disabled={busy || !canSave}
          className="sm:col-span-2 flex items-center justify-center gap-2 py-2.5 bg-[#F53D04] text-white font-black text-xs uppercase hover:bg-[#FF5520] transition-colors disabled:opacity-40"
        >
          {busy ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
          REASSIGN
        </button>
      </div>
    </motion.div>
  );
}

function DataTag({ label, value, missing }: { label: string; value: string; missing: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="font-mono text-[8px] text-neutral-600 uppercase w-8 shrink-0 mt-px">{label}</span>
      <span className={`font-mono text-[10px] line-clamp-1 ${missing ? 'text-amber-400' : 'text-neutral-300'}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Shared toolbar components ────────────────────────────────────────────────

function SearchInput({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative flex-1 max-w-xs">
      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0d0d0d] border border-neutral-700 text-white pl-7 pr-7 py-1.5 font-mono text-xs focus:border-[#00E5FF] outline-none placeholder:text-neutral-600 transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

function SortSelect<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as T)}
      className="bg-[#0d0d0d] border border-neutral-700 text-neutral-300 font-mono text-[10px] px-2 py-1.5 outline-none focus:border-[#00E5FF] transition-colors uppercase appearance-none cursor-pointer pr-6"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23555' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function CleanupTabButton({ active, onClick, label, count }: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-3 font-black text-xs uppercase tracking-widest transition-colors border-b-2 -mb-0.5 capitalize ${
        active
          ? 'text-[#00E5FF] border-[#00E5FF]'
          : 'text-neutral-500 border-transparent hover:text-neutral-300'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`ml-2 px-1.5 py-0.5 text-[9px] font-black ${
          active ? 'bg-[#00E5FF]/10 text-[#00E5FF]' : 'bg-neutral-800 text-neutral-500'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function ComboBox({
  options, value, onChange, placeholder,
}: {
  options: { id: string; label: string; sublabel?: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder: string;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setSearch('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = options.find(o => o.id === value);
  const filtered = options.filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-[#0d0d0d] border border-neutral-700 text-left hover:border-neutral-500 transition-colors"
      >
        <span className={`font-mono text-xs truncate ${selected ? 'text-white' : 'text-neutral-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={11} className="text-neutral-500 shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute top-full left-0 right-0 mt-1 bg-[#111] border border-neutral-700 z-50 max-h-56 flex flex-col"
          >
            <div className="p-2 border-b border-neutral-800">
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full bg-[#0d0d0d] border border-neutral-700 text-white font-mono text-xs px-2 py-1.5 outline-none focus:border-[#00E5FF] transition-colors"
              />
            </div>
            <div className="overflow-y-auto">
              {filtered.length === 0
                ? <p className="font-mono text-xs text-neutral-500 p-3 text-center">No results</p>
                : filtered.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { onChange(opt.id); setOpen(false); setSearch(''); }}
                      className={`w-full text-left px-3 py-2 font-mono text-xs hover:bg-neutral-800 transition-colors flex items-center justify-between ${
                        opt.id === value ? 'text-[#00E5FF] bg-[#00E5FF]/5' : 'text-white'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="text-neutral-500 font-mono text-[10px] shrink-0 ml-2">
                          {opt.sublabel}
                        </span>
                      )}
                    </button>
                  ))
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MultiComboBox({
  options, value, onChange, placeholder,
}: {
  options: { id: string; label: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setSearch('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);

  const filtered = options.filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {value.map(id => {
            const opt = options.find(o => o.id === id);
            if (!opt) return null;
            return (
              <span
                key={id}
                className="flex items-center gap-1 pl-2 pr-1 py-0.5 bg-[#00E5FF]/10 border border-[#00E5FF]/30 font-mono text-[10px] text-[#00E5FF]"
              >
                {opt.label}
                <button type="button" onClick={() => toggle(id)} className="hover:text-white ml-0.5">
                  <X size={9} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-[#0d0d0d] border border-neutral-700 text-left hover:border-neutral-500 transition-colors"
      >
        <span className="font-mono text-xs text-neutral-500 truncate">
          {value.length > 0 ? `${value.length} artist${value.length !== 1 ? 's' : ''} selected` : placeholder}
        </span>
        <ChevronDown size={11} className="text-neutral-500 shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute top-full left-0 right-0 mt-1 bg-[#111] border border-neutral-700 z-50 max-h-56 flex flex-col"
          >
            <div className="p-2 border-b border-neutral-800">
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search artists…"
                className="w-full bg-[#0d0d0d] border border-neutral-700 text-white font-mono text-xs px-2 py-1.5 outline-none focus:border-[#00E5FF] transition-colors"
              />
            </div>
            <div className="overflow-y-auto">
              {filtered.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggle(opt.id)}
                  className={`w-full text-left px-3 py-2 font-mono text-xs hover:bg-neutral-800 transition-colors flex items-center gap-2 ${
                    value.includes(opt.id) ? 'text-[#00E5FF]' : 'text-neutral-300'
                  }`}
                >
                  <span className={`w-3 h-3 border shrink-0 flex items-center justify-center ${
                    value.includes(opt.id)
                      ? 'border-[#00E5FF] bg-[#00E5FF]/20'
                      : 'border-neutral-600'
                  }`}>
                    {value.includes(opt.id) && <Check size={8} />}
                  </span>
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Toast({ toast }: { toast: ToastItem }) {
  return (
    <motion.div
      initial={{ x: 48, opacity: 0 }}
      animate={{ x: 0,  opacity: 1 }}
      exit={{ x: 48,  opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`flex items-center gap-2.5 px-4 py-3 border font-mono text-xs uppercase tracking-widest pointer-events-auto max-w-xs ${
        toast.type === 'success'
          ? 'bg-black border-[#00E5FF] text-[#00E5FF]'
          : 'bg-black border-[#F53D04] text-[#F53D04]'
      }`}
    >
      {toast.type === 'success' ? <Check size={12} /> : <AlertTriangle size={12} />}
      <span className="line-clamp-2">{toast.message}</span>
    </motion.div>
  );
}

function Spinner() {
  return (
    <div className="text-center py-16 font-mono text-xs text-neutral-500 uppercase animate-pulse tracking-widest">
      Loading…
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-24 font-mono">
      <Check size={22} className="text-green-500 mx-auto mb-3" />
      <p className="text-neutral-400 text-sm">{message}</p>
    </div>
  );
}
