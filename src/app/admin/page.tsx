"use client";

import { useReducer, useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  RefreshCw, BarChart2, Database, Inbox, Radio,
  Share2, ChevronRight, Flag,
} from 'lucide-react';
import { ReviewQueue }         from '@/features/admin/ReviewQueue';
import { LiveEventsTab }       from '@/features/admin/LiveEventsTab';
import { CleanupTabContent }   from '@/features/admin/data-cleanup/DataCleanupDashboard';
import { StatsTab }            from '@/features/admin/StatsTab';
import { ReportsTab }          from '@/features/admin/ReportsTab';
import WeeklyLineupModal       from '@/components/admin/WeeklyLineupModal';
import { type StoryEvent }     from '@/components/admin/generateWeeklyStory';
import { cmsReducer, initialCMSState } from '@/types/admin';
import type { CMSTab, AdminPendingEvent, AdminLiveEvent } from '@/types/admin';

// ─── Toast system ─────────────────────────────────────────────────────────────

interface Toast { id: string; message: string; type: 'success' | 'error' }

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return { toasts, add };
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [state, dispatch] = useReducer(cmsReducer, initialCMSState);
  const { toasts, add: addToast } = useToasts();
  const [showLineup, setShowLineup] = useState(false);
  const [authInput,  setAuthInput]  = useState('');
  const [authBusy,   setAuthBusy]   = useState(false);
  const [authError,  setAuthError]  = useState('');

  // ── Data fetchers ────────────────────────────────────────────────────────────

  const fetchQueue = useCallback(async (pass: string) => {
    dispatch({ type: 'SET_LOADING', key: 'queue', value: true });
    try {
      const res  = await fetch('/api/admin/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed');
      dispatch({ type: 'LOAD_QUEUE', events: data.data as AdminPendingEvent[] });
      return true;
    } catch {
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', key: 'queue', value: false });
    }
  }, []);

  const fetchLive = useCallback(async (pass: string) => {
    dispatch({ type: 'SET_LOADING', key: 'live', value: true });
    try {
      const res  = await fetch('/api/admin/live-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed');
      dispatch({ type: 'LOAD_LIVE', events: (data.events ?? []) as AdminLiveEvent[] });
    } finally {
      dispatch({ type: 'SET_LOADING', key: 'live', value: false });
    }
  }, []);

  // ── Auth ─────────────────────────────────────────────────────────────────────

  const handleAuth = async () => {
    if (!authInput.trim()) return;
    setAuthBusy(true);
    setAuthError('');
    const ok = await fetchQueue(authInput);
    if (ok) {
      dispatch({ type: 'AUTH_SUCCESS', password: authInput, events: [] });
      // AUTH_SUCCESS with empty array is fine — LOAD_QUEUE above already ran
    } else {
      setAuthError('Wrong password.');
    }
    setAuthBusy(false);
  };

  // ── Tab change ───────────────────────────────────────────────────────────────

  const handleTabChange = (tab: CMSTab) => {
    dispatch({ type: 'SET_TAB', tab });
    if (tab === 'live' && !state.liveLoaded) fetchLive(state.password);
  };

  // ── Refresh ──────────────────────────────────────────────────────────────────

  const handleRefresh = () => {
    if (state.activeTab === 'review') fetchQueue(state.password);
    if (state.activeTab === 'live')   fetchLive(state.password);
  };

  const isRefreshing = state.loading['queue'] || state.loading['live'];
  const totalPending = state.scraperQueue.length + state.userQueue.length;

  // ── Auth gate ─────────────────────────────────────────────────────────────────

  if (!state.isAuth) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        {/* Ambient glow */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#00E5FF]/3 rounded-full blur-[120px]" />
        </div>

        <div className="w-full max-w-sm relative">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
              <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-[0.3em]">AfterFive CMS</span>
            </div>
            <h1 className="font-black text-3xl text-white uppercase tracking-tighter">
              Admin Access
            </h1>
          </div>

          <div className="bg-[#111] border border-neutral-800 p-6 shadow-[0_0_60px_rgba(0,229,255,0.04)]">
            <input
              type="password"
              placeholder="ENTER PASSWORD"
              className="w-full bg-[#0a0a0a] border border-neutral-700 text-white p-3 font-mono text-sm text-center focus:border-[#00E5FF] focus:outline-none placeholder:text-neutral-600 transition-colors mb-3"
              value={authInput}
              onChange={e => { setAuthInput(e.target.value); setAuthError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
              autoFocus
            />
            {authError && (
              <p className="text-[#FF3D00] font-mono text-xs text-center mb-3">{authError}</p>
            )}
            <button
              onClick={handleAuth}
              disabled={authBusy || !authInput.trim()}
              className="w-full bg-[#00E5FF] text-black font-black p-3 uppercase text-sm hover:bg-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {authBusy ? <RefreshCw size={14} className="animate-spin" /> : <ChevronRight size={14} />}
              {authBusy ? 'Authenticating…' : 'Enter'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────────

  const tabs: { id: CMSTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'review',  label: 'Review',    icon: <Inbox size={13} />,    count: totalPending  },
    { id: 'live',    label: 'Live',      icon: <Radio size={13} />,    count: state.liveLoaded ? state.liveEvents.length : undefined },
    { id: 'cleanup', label: 'Cleanup',   icon: <Database size={13} />  },
    { id: 'stats',   label: 'Analytics', icon: <BarChart2 size={13} /> },
    { id: 'reports', label: 'Reports',   icon: <Flag size={13} />      },
  ];

  return (
    <>
      <div className="min-h-screen bg-[#0a0a0a] text-white">

        {/* ── Top accent line ─────────────────────────────────────── */}
        <div className="h-px w-full" style={{
          background: 'linear-gradient(90deg, #00E5FF 0%, #76FF03 50%, transparent 100%)',
        }} />

        <div className="max-w-7xl mx-auto px-4 md:px-6 py-5">

          {/* ── Header ────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="font-black text-2xl uppercase tracking-tighter text-white leading-none">
                  AfterFive<span className="text-[#00E5FF]">.</span>CMS
                </h1>
                <p className="font-mono text-[10px] text-neutral-600 mt-0.5 uppercase tracking-widest">
                  Event moderation &amp; data management
                </p>
              </div>
              {totalPending > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F59E0B]/10 border border-[#F59E0B]/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse" />
                  <span className="font-mono text-[10px] text-[#F59E0B] uppercase tracking-widest">
                    {totalPending} pending
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!state.liveLoaded) fetchLive(state.password);
                  setShowLineup(true);
                }}
                className="flex items-center gap-2 px-3 py-2 bg-[#F53D04] text-white font-black text-[10px] uppercase tracking-widest hover:bg-[#FF5520] transition-colors"
              >
                <Share2 size={12} />
                <span className="hidden sm:inline">Weekly Story</span>
              </button>

              {(state.activeTab === 'review' || state.activeTab === 'live') && (
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-2 px-3 py-2 border border-neutral-800 text-neutral-400 font-mono text-[10px] uppercase hover:bg-neutral-900 hover:text-white disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              )}
            </div>
          </div>

          {/* ── Tab bar ───────────────────────────────────────────── */}
          <div className="flex items-end gap-0 border-b border-neutral-800 mb-6">
            {tabs.map(tab => {
              const active = state.activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3 font-black text-xs uppercase tracking-widest transition-colors border-b-2 -mb-px whitespace-nowrap ${
                    active
                      ? 'text-[#00E5FF] border-[#00E5FF]'
                      : 'text-neutral-500 border-transparent hover:text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <span className={active ? 'opacity-100' : 'opacity-50'}>{tab.icon}</span>
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-none ${
                      active ? 'bg-[#00E5FF]/10 text-[#00E5FF]' : 'bg-neutral-900 text-neutral-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Tab Content ───────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={state.activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {state.activeTab === 'review' && (
                <ReviewQueue
                  scraperQueue={state.scraperQueue}
                  userQueue={state.userQueue}
                  subTab={state.reviewSubTab}
                  expandedId={state.expandedId}
                  password={state.password}
                  dispatch={dispatch}
                />
              )}

              {state.activeTab === 'live' && (
                state.loading['live'] && !state.liveLoaded ? (
                  <div className="py-24 text-center font-mono text-xs text-neutral-600 uppercase animate-pulse tracking-widest">
                    Loading live events…
                  </div>
                ) : (
                  <LiveEventsTab
                    events={state.liveEvents}
                    expandedId={state.expandedId}
                    password={state.password}
                    dispatch={dispatch}
                  />
                )
              )}

              {state.activeTab === 'cleanup' && (
                <CleanupTabContent password={state.password} />
              )}

              {state.activeTab === 'stats' && (
                <StatsTab password={state.password} />
              )}

              {state.activeTab === 'reports' && (
                <ReportsTab password={state.password} />
              )}
            </motion.div>
          </AnimatePresence>

        </div>
      </div>

      {/* ── Weekly Story Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {showLineup && (
          <WeeklyLineupModal
            events={state.liveEvents as unknown as StoryEvent[]}
            darkMode
            onClose={() => setShowLineup(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Toast Stack ───────────────────────────────────────── */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ x: 48, opacity: 0 }}
              animate={{ x: 0,  opacity: 1 }}
              exit={{ x: 48,  opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={`flex items-center gap-2.5 px-4 py-3 border font-mono text-xs uppercase tracking-widest pointer-events-auto max-w-xs ${
                t.type === 'success'
                  ? 'bg-[#0a0a0a] border-[#76FF03] text-[#76FF03]'
                  : 'bg-[#0a0a0a] border-[#FF3D00] text-[#FF3D00]'
              }`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
