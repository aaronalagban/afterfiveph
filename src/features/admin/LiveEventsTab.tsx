"use client";

import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, ExternalLink, ImageOff, ChevronDown } from 'lucide-react';
import { InlineReviewPanel } from './InlineReviewPanel';
import type { AdminLiveEvent, CMSAction } from '@/types/admin';

interface Props {
  events:     AdminLiveEvent[];
  expandedId: string | null;
  password:   string;
  dispatch:   React.Dispatch<CMSAction>;
}

function formatEventTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function LiveEventsTab({ events, expandedId, password, dispatch }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle
      ? events.filter(e =>
          e.event_name.toLowerCase().includes(needle) ||
          e.club_name.toLowerCase().includes(needle) ||
          (e.dj_name ?? '').toLowerCase().includes(needle) ||
          (e.djs ?? []).some(d => d.toLowerCase().includes(needle))
        )
      : events;
  }, [events, search]);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search live events…"
            className="w-full bg-[#111] border border-neutral-800 text-white pl-7 pr-7 py-1.5 font-mono text-[10px] focus:border-[#00E5FF] focus:outline-none placeholder:text-neutral-600 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white">
              <X size={9} />
            </button>
          )}
        </div>
        <span className="font-mono text-[10px] text-neutral-600">
          {filtered.length}{search ? ` / ${events.length}` : ''} events
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="py-24 text-center">
          <p className="font-mono text-sm text-neutral-600">
            {search ? `No events match "${search}"` : 'No upcoming live events.'}
          </p>
        </div>
      ) : (
        <div className="border border-neutral-800 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#0a0a0a] border-b border-neutral-800">
                {['Poster', 'Event', 'DJs', 'Date · Time', 'Venue', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-mono text-[9px] text-neutral-600 uppercase tracking-widest font-normal whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {filtered.map(event => (
                  <LiveEventRow
                    key={event.id}
                    event={event}
                    isExpanded={expandedId === event.id}
                    password={password}
                    dispatch={dispatch}
                    onToggle={() => dispatch({ type: 'EXPAND', id: expandedId === event.id ? null : event.id })}
                  />
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LiveEventRow({ event, isExpanded, password, dispatch, onToggle }: {
  event:      AdminLiveEvent;
  isExpanded: boolean;
  password:   string;
  dispatch:   React.Dispatch<CMSAction>;
  onToggle:   () => void;
}) {
  const timeStr = event.starts_at
    ? formatEventTime(event.starts_at) + (event.ends_at ? ` – ${formatEventTime(event.ends_at)}` : '')
    : '';

  return (
    <>
      <motion.tr
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onToggle}
        className={`border-b border-neutral-800 cursor-pointer transition-colors ${
          isExpanded ? 'bg-[#161616]' : 'hover:bg-[#161616]'
        }`}
      >
        <td className="pl-3 pr-2 py-2 w-[72px]">
          <div className="w-14 h-[64px] overflow-hidden border border-neutral-800 bg-neutral-900 shrink-0">
            {event.image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={event.image_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              : <div className="w-full h-full flex items-center justify-center text-neutral-700"><ImageOff size={14} /></div>
            }
          </div>
        </td>
        <td className="px-4 py-2 max-w-[220px]">
          <p className="font-black text-sm text-white uppercase tracking-tight truncate">{event.event_name}</p>
        </td>
        <td className="px-4 py-2 max-w-[160px]">
          <p className="font-mono text-[10px] text-neutral-400 truncate">
            {event.djs?.join(', ') || event.dj_name || '—'}
          </p>
        </td>
        <td className="px-4 py-2 whitespace-nowrap">
          <p className="font-mono text-xs text-neutral-300">{event.event_date}</p>
          {timeStr && <p className="font-mono text-[10px] text-neutral-600">{timeStr}</p>}
        </td>
        <td className="px-4 py-2 max-w-[160px]">
          <p className="font-mono text-xs text-neutral-300 truncate">{event.club_name}</p>
          {event.city && <p className="font-mono text-[10px] text-neutral-600">{event.city}</p>}
        </td>
        <td className="px-4 py-2 whitespace-nowrap">
          <div className="flex items-center gap-2">
            {event.ig_post_url && (
              <a
                href={event.ig_post_url.split('#')[0]}
                target="_blank"
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="p-1.5 text-neutral-600 hover:text-[#00E5FF] transition-colors"
              >
                <ExternalLink size={12} />
              </a>
            )}
            <button
              onClick={onToggle}
              className={`flex items-center gap-1 px-2.5 py-1.5 border font-black text-[10px] uppercase transition-colors ${
                isExpanded
                  ? 'border-[#00E5FF] text-[#00E5FF]'
                  : 'border-neutral-700 text-neutral-500 hover:border-neutral-500 hover:text-neutral-300'
              }`}
            >
              Edit <ChevronDown size={10} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </td>
      </motion.tr>

      {isExpanded && (
        <tr>
          <td colSpan={6} className="p-0">
            <AnimatePresence>
              <InlineReviewPanel
                event={event}
                mode="live"
                password={password}
                onSaved={(id, fields) => dispatch({ type: 'UPDATE_LIVE', id, fields: fields as Partial<AdminLiveEvent> })}
                onDeleted={id => dispatch({ type: 'DELETE_LIVE', id })}
                onClose={() => dispatch({ type: 'EXPAND', id: null })}
              />
            </AnimatePresence>
          </td>
        </tr>
      )}
    </>
  );
}
