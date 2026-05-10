"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flag, X, Upload, AlertCircle, CheckCircle2, Search, ChevronDown } from 'lucide-react';
import { CORRECTABLE_FIELDS } from '@/types/reports';
import { supabase } from '@/lib/supabase-client';

type ReportType = 'data_correction' | 'bug_report';
type Phase = 'idle' | 'submitting' | 'success' | 'error';

interface EventOption {
  id: number;
  event_name: string | null;
  club_name: string;
  dj_name: string | null;
}

const MAX_SCREENSHOTS = 3;

export default function ReportButton() {
  const [open, setOpen]             = useState(false);
  const [type, setType]             = useState<ReportType>('data_correction');

  // Data correction state
  const [events, setEvents]         = useState<EventOption[]>([]);
  const [eventsLoaded, setEvLoaded] = useState(false);
  const [evLoading, setEvLoading]   = useState(false);
  const [search, setSearch]         = useState('');
  const [showList, setShowList]     = useState(false);
  const [selectedEvent, setSelEv]   = useState<EventOption | null>(null);
  const [fieldName, setFieldName]   = useState('');
  const [proposed, setProposed]     = useState('');

  // Bug report state
  const [description, setDesc]      = useState('');
  const [files, setFiles]           = useState<File[]>([]);

  const [phase, setPhase]           = useState<Phase>('idle');
  const [errorMsg, setErrorMsg]     = useState('');
  const fileRef  = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch events once when modal first opens
  const loadEvents = useCallback(async () => {
    if (eventsLoaded || evLoading || !supabase) return;
    setEvLoading(true);
    const { data } = await supabase
      .from('events')
      .select('id, event_name, club_name, dj_name')
      .order('event_date', { ascending: false })
      .limit(300);
    setEvents(data ?? []);
    setEvLoaded(true);
    setEvLoading(false);
  }, [eventsLoaded, evLoading]);

  useEffect(() => {
    if (open) loadEvents();
  }, [open, loadEvents]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showList) return;
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.closest('.event-picker')?.contains(e.target as Node)) {
        setShowList(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showList]);

  const filteredEvents: EventOption[] = search.trim()
    ? events.filter(e =>
        [e.event_name, e.club_name, e.dj_name].some(s =>
          s?.toLowerCase().includes(search.toLowerCase())
        )
      ).slice(0, 30)
    : events.slice(0, 30);

  function reset() {
    setType('data_correction');
    setSearch('');
    setShowList(false);
    setSelEv(null);
    setFieldName('');
    setProposed('');
    setDesc('');
    setFiles([]);
    setPhase('idle');
    setErrorMsg('');
  }

  function close() {
    setOpen(false);
    setTimeout(reset, 300);
  }

  function selectEvent(ev: EventOption) {
    setSelEv(ev);
    setSearch('');
    setShowList(false);
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(e.target.files ?? []).slice(0, MAX_SCREENSHOTS));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase('submitting');
    setErrorMsg('');

    try {
      const fd = new FormData();
      fd.append('type', type);

      if (type === 'data_correction') {
        if (!selectedEvent) throw new Error('Select which poster has the wrong data.');
        if (!fieldName)      throw new Error('Select which field is incorrect.');
        if (!proposed.trim()) throw new Error('Enter the correct value.');
        fd.append('event_id',       String(selectedEvent.id));
        fd.append('event_name',     selectedEvent.event_name ?? selectedEvent.club_name);
        fd.append('field_name',     fieldName);
        fd.append('proposed_value', proposed.trim());
      } else {
        if (!description.trim()) throw new Error('Please describe the bug.');
        fd.append('event_name',   '');
        fd.append('description',  description.trim());
        files.forEach(f => fd.append('screenshots', f));
      }

      const res  = await fetch('/api/report/submit', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Submission failed');
      setPhase('success');
    } catch (err) {
      setPhase('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <>
      {/* ── Trigger — icon-only on mobile, labeled on desktop ──────────── */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Report an issue"
        className="flex items-center gap-1.5 p-2 md:px-3 md:py-2 bg-black/40 backdrop-blur-sm border border-white/[0.08] text-white/25 hover:text-white/50 hover:border-white/15 transition-all group rounded-none"
      >
        <Flag size={10} className="group-hover:fill-white/10 transition-all shrink-0" />
        <span className="hidden md:block font-mono text-[9px] uppercase tracking-widest">Report</span>
      </button>

      {/* ── Modal ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
              onClick={close}
            />

            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="w-full max-w-md bg-[#0d0d0d] border border-neutral-800 shadow-[0_0_60px_rgba(0,0,0,0.8)] pointer-events-auto"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
                  <div className="flex items-center gap-2.5">
                    <Flag size={13} className="text-[#F59E0B]" />
                    <span className="font-black text-sm uppercase tracking-widest text-white">
                      Report an Issue
                    </span>
                  </div>
                  <button onClick={close} className="text-neutral-600 hover:text-white transition-colors">
                    <X size={15} />
                  </button>
                </div>

                {/* Body */}
                <div className="px-5 py-5">
                  {phase === 'success' ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <CheckCircle2 size={32} className="text-[#76FF03]" />
                      <p className="font-black text-sm uppercase tracking-widest text-white">
                        Report Submitted
                      </p>
                      <p className="font-mono text-[11px] text-neutral-500">
                        Our team will review it shortly.
                      </p>
                      <button
                        onClick={close}
                        className="mt-2 px-5 py-2 bg-neutral-900 border border-neutral-700 text-white font-mono text-[11px] uppercase hover:border-neutral-500 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">

                      {/* Type toggle */}
                      <div className="grid grid-cols-2 gap-1 bg-[#0a0a0a] border border-neutral-800 p-1">
                        {(['data_correction', 'bug_report'] as const).map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setType(t)}
                            className={`py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                              type === t
                                ? 'bg-[#F59E0B] text-black font-black'
                                : 'text-neutral-500 hover:text-neutral-300'
                            }`}
                          >
                            {t === 'data_correction' ? 'Data Correction' : 'Bug Report'}
                          </button>
                        ))}
                      </div>

                      {/* ── Data Correction ── */}
                      {type === 'data_correction' && (
                        <div className="space-y-3">

                          {/* Event picker */}
                          <div>
                            <label className="block font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">
                              Which Poster?
                            </label>

                            {selectedEvent ? (
                              <div className="flex items-center justify-between px-3 py-2 border border-[#F59E0B]/50 bg-[#F59E0B]/5">
                                <div className="min-w-0">
                                  <p className="font-black text-xs text-white truncate">
                                    {selectedEvent.event_name ?? selectedEvent.club_name}
                                  </p>
                                  <p className="font-mono text-[10px] text-neutral-500 truncate">
                                    {selectedEvent.club_name}{selectedEvent.dj_name ? ` · ${selectedEvent.dj_name}` : ''}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => { setSelEv(null); setFieldName(''); setProposed(''); }}
                                  className="ml-2 text-neutral-600 hover:text-white shrink-0"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <div className="event-picker relative">
                                <div className="relative">
                                  <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" />
                                  <input
                                    ref={searchRef}
                                    type="text"
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setShowList(true); }}
                                    onFocus={() => setShowList(true)}
                                    placeholder={evLoading ? 'Loading events…' : 'Search by event, venue, or DJ…'}
                                    className="w-full bg-[#0a0a0a] border border-neutral-700 text-white font-mono text-xs pl-7 pr-3 py-2.5 focus:border-[#F59E0B] focus:outline-none placeholder:text-neutral-700 transition-colors"
                                  />
                                  <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" />
                                </div>

                                {showList && (
                                  <div className="absolute top-full left-0 right-0 z-10 mt-1 border border-neutral-700 bg-[#111] max-h-44 overflow-y-auto">
                                    {filteredEvents.length === 0 ? (
                                      <div className="px-3 py-3 font-mono text-[11px] text-neutral-600">
                                        {evLoading ? 'Loading…' : 'No events found'}
                                      </div>
                                    ) : (
                                      filteredEvents.map(ev => (
                                        <button
                                          key={ev.id}
                                          type="button"
                                          onMouseDown={() => selectEvent(ev)}
                                          className="w-full flex flex-col items-start px-3 py-2 hover:bg-neutral-800 text-left transition-colors border-b border-neutral-800 last:border-0"
                                        >
                                          <span className="font-black text-xs text-white truncate w-full">
                                            {ev.event_name ?? ev.club_name}
                                          </span>
                                          <span className="font-mono text-[10px] text-neutral-500 truncate w-full">
                                            {ev.club_name}{ev.dj_name ? ` · ${ev.dj_name}` : ''}
                                          </span>
                                        </button>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Field + value — only shown after event selected */}
                          {selectedEvent && (
                            <>
                              <div>
                                <label className="block font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">
                                  Wrong Field
                                </label>
                                <select
                                  value={fieldName}
                                  onChange={e => setFieldName(e.target.value)}
                                  required
                                  className="w-full bg-[#0a0a0a] border border-neutral-700 text-white font-mono text-xs p-2.5 focus:border-[#F59E0B] focus:outline-none transition-colors appearance-none"
                                >
                                  <option value="">Select a field…</option>
                                  {Object.entries(CORRECTABLE_FIELDS).map(([val, label]) => (
                                    <option key={val} value={val}>{label}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">
                                  Correct Value
                                </label>
                                <input
                                  type="text"
                                  value={proposed}
                                  onChange={e => setProposed(e.target.value)}
                                  placeholder="Enter the correct information…"
                                  required
                                  className="w-full bg-[#0a0a0a] border border-neutral-700 text-white font-mono text-xs p-2.5 focus:border-[#F59E0B] focus:outline-none placeholder:text-neutral-700 transition-colors"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* ── Bug Report ── */}
                      {type === 'bug_report' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">
                              Describe the Problem
                            </label>
                            <textarea
                              value={description}
                              onChange={e => setDesc(e.target.value)}
                              placeholder="What went wrong? What did you expect to happen?"
                              required
                              rows={4}
                              className="w-full bg-[#0a0a0a] border border-neutral-700 text-white font-mono text-xs p-2.5 focus:border-[#F59E0B] focus:outline-none placeholder:text-neutral-700 transition-colors resize-none"
                            />
                          </div>
                          <div>
                            <label className="block font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">
                              Screenshots (optional, up to {MAX_SCREENSHOTS})
                            </label>
                            <input
                              ref={fileRef}
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={handleFiles}
                            />
                            <button
                              type="button"
                              onClick={() => fileRef.current?.click()}
                              className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-neutral-700 text-neutral-500 hover:border-neutral-500 hover:text-neutral-300 transition-colors font-mono text-[10px] uppercase tracking-widest"
                            >
                              <Upload size={12} />
                              {files.length > 0
                                ? `${files.length} file${files.length > 1 ? 's' : ''} selected`
                                : 'Attach screenshots'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Error */}
                      {phase === 'error' && (
                        <div className="flex items-start gap-2 px-3 py-2.5 border border-[#FF3D00]/30 bg-[#FF3D00]/5">
                          <AlertCircle size={12} className="text-[#FF3D00] mt-0.5 shrink-0" />
                          <p className="font-mono text-[11px] text-[#FF3D00]">{errorMsg}</p>
                        </div>
                      )}

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={phase === 'submitting'}
                        className="w-full py-3 bg-[#F59E0B] text-black font-black text-xs uppercase tracking-widest hover:bg-[#FCD34D] disabled:opacity-50 transition-colors"
                      >
                        {phase === 'submitting' ? 'Submitting…' : 'Submit Report'}
                      </button>

                    </form>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
