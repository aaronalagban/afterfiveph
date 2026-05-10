"use client";

import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Zap, ImageOff, ExternalLink, Search, X, Loader, SlidersHorizontal } from 'lucide-react';
import { ConfidenceBar, confidenceColor, ConfidencePill } from '@/components/admin/ConfidenceBar';
import { InlineReviewPanel } from './InlineReviewPanel';
import type { AdminPendingEvent, CMSAction, ReviewSubTab } from '@/types/admin';

interface Props {
  scraperQueue: AdminPendingEvent[];
  userQueue:    AdminPendingEvent[];
  subTab:       ReviewSubTab;
  expandedId:   string | null;
  password:     string;
  dispatch:     React.Dispatch<CMSAction>;
}

type SortKey = 'confidence_desc' | 'confidence_asc' | 'date_asc' | 'date_desc' | 'newest';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'confidence_desc', label: 'Confidence: High' },
  { value: 'confidence_asc',  label: 'Confidence: Low'  },
  { value: 'newest',          label: 'Newest First'      },
  { value: 'date_asc',        label: 'Event: Soonest'    },
  { value: 'date_desc',       label: 'Event: Latest'     },
];

function sortEvents(events: AdminPendingEvent[], key: SortKey): AdminPendingEvent[] {
  return [...events].sort((a, b) => {
    switch (key) {
      case 'confidence_desc': return (b.confidence_score ?? -1) - (a.confidence_score ?? -1);
      case 'confidence_asc':  return (a.confidence_score ?? 2)  - (b.confidence_score ?? 2);
      case 'newest':          return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      case 'date_asc':        return new Date(a.event_date ?? '').getTime() - new Date(b.event_date ?? '').getTime();
      case 'date_desc':       return new Date(b.event_date ?? '').getTime() - new Date(a.event_date ?? '').getTime();
    }
  });
}

export function ReviewQueue({ scraperQueue, userQueue, subTab, expandedId, password, dispatch }: Props) {
  const [search, setSearch] = useState('');
  const [sort,   setSort]   = useState<SortKey>('confidence_desc');

  const activeQueue = subTab === 'scraper' ? scraperQueue : userQueue;

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list   = needle
      ? activeQueue.filter(e =>
          (e.event_name   ?? '').toLowerCase().includes(needle) ||
          (e.club_name    ?? '').toLowerCase().includes(needle) ||
          (e.dj_name      ?? '').toLowerCase().includes(needle) ||
          (e.djs ?? []).some(d => d.toLowerCase().includes(needle))
        )
      : activeQueue;
    return sortEvents(list, sort);
  }, [activeQueue, search, sort]);

  const scraperCount = scraperQueue.length;
  const userCount    = userQueue.length;

  return (
    <div className="flex flex-col gap-0">

      {/* Sub-tab bar */}
      <div className="flex items-center gap-0 border-b border-neutral-800 mb-4">
        <SubTab
          active={subTab === 'scraper'}
          onClick={() => dispatch({ type: 'SET_REVIEW_SUB', sub: 'scraper' })}
          label="AI Scraper"
          count={scraperCount}
          color="#00E5FF"
        />
        <SubTab
          active={subTab === 'users'}
          onClick={() => dispatch({ type: 'SET_REVIEW_SUB', sub: 'users' })}
          label="User Submissions"
          count={userCount}
          color="#76FF03"
        />
        <div className="flex-1" />

        {/* Toolbar */}
        <div className="flex items-center gap-2 pb-2">
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search queue…"
              className="w-44 bg-[#111] border border-neutral-800 text-white pl-7 pr-7 py-1.5 font-mono text-[10px] focus:border-[#00E5FF] focus:outline-none placeholder:text-neutral-600 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white">
                <X size={9} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-[#111] border border-neutral-800 px-2 py-1.5">
            <SlidersHorizontal size={10} className="text-neutral-500" />
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="bg-transparent text-neutral-300 font-mono text-[10px] outline-none cursor-pointer"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <span className="font-mono text-[10px] text-neutral-600 whitespace-nowrap">
            {filtered.length}{search ? ` / ${activeQueue.length}` : ''}
          </span>
        </div>
      </div>

      {/* Queue list */}
      {filtered.length === 0 ? (
        <EmptyQueue search={search} subTab={subTab} />
      ) : (
        <div className="flex flex-col gap-px">
          <AnimatePresence initial={false}>
            {filtered.map(event => (
              <QueueEntry
                key={event.id}
                event={event}
                isExpanded={expandedId === event.id}
                password={password}
                dispatch={dispatch}
                onToggle={() => dispatch({ type: 'EXPAND', id: expandedId === event.id ? null : event.id })}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ─── Individual queue row ─────────────────────────────────────────────────────

function QueueEntry({
  event, isExpanded, password, dispatch, onToggle,
}: {
  event:      AdminPendingEvent;
  isExpanded: boolean;
  password:   string;
  dispatch:   React.Dispatch<CMSAction>;
  onToggle:   () => void;
}) {
  const [quickApproving, setQuickApproving] = useState(false);

  const color = confidenceColor(event.confidence_score);
  const canQuickApprove = (event.confidence_score ?? 0) >= 0.75 && !!event.image_url;

  const handleQuickApprove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickApproving(true);
    try {
      const res  = await fetch('/api/admin/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, pendingEventId: event.id, fields: {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Promote failed');
      dispatch({ type: 'PROMOTE', id: event.id });
    } catch {
      setQuickApproving(false);
    }
  };

  const djLabel = event.djs?.length
    ? event.djs.join(', ')
    : event.dj_name ?? '—';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
    >
      {/* Collapsed row */}
      <div
        onClick={onToggle}
        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none transition-colors border-l-2 ${
          isExpanded ? 'bg-[#161616] border-[#00E5FF]' : 'bg-[#111] hover:bg-[#161616] border-transparent hover:border-neutral-700'
        }`}
        style={{ borderLeftColor: isExpanded ? color : undefined }}
      >
        {/* Poster thumbnail */}
        <div className="w-14 h-[72px] shrink-0 bg-neutral-900 border border-neutral-800 overflow-hidden">
          {event.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.image_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-700"><ImageOff size={14} /></div>
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm text-white uppercase tracking-tight truncate leading-tight">
            {event.event_name ?? <span className="text-neutral-600 italic font-normal normal-case">Untitled</span>}
          </p>
          <p className="font-mono text-[10px] text-neutral-500 truncate mt-0.5">
            {event.club_name}{event.city ? ` · ${event.city}` : ''}{event.event_date ? ` · ${event.event_date}` : ''}
          </p>
          <p className="font-mono text-[10px] text-neutral-600 truncate">
            {djLabel}
          </p>
        </div>

        {/* Confidence */}
        <div className="w-24 shrink-0 hidden sm:block">
          <ConfidenceBar score={event.confidence_score} size="sm" />
        </div>

        <ConfidencePill score={event.confidence_score} />

        {/* IG link */}
        {event.ig_post_url && (
          <a
            href={event.ig_post_url.split('#')[0]}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="shrink-0 p-1.5 text-neutral-600 hover:text-[#00E5FF] transition-colors"
          >
            <ExternalLink size={12} />
          </a>
        )}

        {/* Quick approve */}
        {canQuickApprove && (
          <button
            onClick={handleQuickApprove}
            disabled={quickApproving}
            title="Quick Approve — uses current AI data as-is"
            className="shrink-0 flex items-center gap-1 px-2 py-1.5 border border-[#76FF03]/40 text-[#76FF03] font-black text-[10px] uppercase hover:bg-[#76FF03] hover:text-black hover:border-[#76FF03] disabled:opacity-40 transition-all"
          >
            {quickApproving ? <Loader size={11} className="animate-spin" /> : <Zap size={11} />}
            <span className="hidden lg:inline">Quick</span>
          </button>
        )}

        {/* Expand toggle */}
        <button
          onClick={onToggle}
          className="shrink-0 px-2 py-1.5 border border-neutral-700 text-neutral-500 hover:border-[#00E5FF] hover:text-[#00E5FF] transition-colors font-black text-[10px] uppercase flex items-center gap-1"
        >
          <span className="hidden lg:inline">{isExpanded ? 'Close' : 'Review'}</span>
          <ChevronDown size={11} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expanded inline panel */}
      <AnimatePresence>
        {isExpanded && (
          <InlineReviewPanel
            event={event}
            mode="pending"
            password={password}
            onPromoted={id => dispatch({ type: 'PROMOTE', id })}
            onRejected={id => dispatch({ type: 'REJECT',  id })}
            onSaved={(id, fields) => dispatch({ type: 'UPDATE_PENDING', id, fields })}
            onDeleted={id => dispatch({ type: 'DELETE_PENDING', id })}
            onClose={() => dispatch({ type: 'EXPAND', id: null })}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Sub-tab button ──────────────────────────────────────────────────────────

function SubTab({ active, onClick, label, count, color }: {
  active: boolean; onClick: () => void; label: string; count: number; color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 pb-3 font-black text-xs uppercase tracking-widest transition-colors border-b-2 -mb-px ${
        active ? 'border-current' : 'text-neutral-500 border-transparent hover:text-neutral-300'
      }`}
      style={active ? { color, borderColor: color } : {}}
    >
      {label}
      <span
        className="px-1.5 py-0.5 text-[9px] font-black rounded-none"
        style={active
          ? { backgroundColor: `${color}15`, color }
          : { backgroundColor: '#1a1a1a', color: '#555' }
        }
      >
        {count}
      </span>
    </button>
  );
}

function EmptyQueue({ search, subTab }: { search: string; subTab: ReviewSubTab }) {
  if (search) {
    return (
      <div className="py-24 text-center">
        <p className="font-mono text-sm text-neutral-600">No events match &ldquo;{search}&rdquo;</p>
      </div>
    );
  }
  return (
    <div className="py-24 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 border border-neutral-800 mb-4">
        <span className="text-2xl">{subTab === 'scraper' ? '🤖' : '👤'}</span>
      </div>
      <p className="font-black text-sm text-neutral-500 uppercase tracking-widest">Queue is empty</p>
      <p className="font-mono text-xs text-neutral-700 mt-1">
        {subTab === 'scraper' ? 'No pending scraper events.' : 'No user submissions.'}
      </p>
    </div>
  );
}
