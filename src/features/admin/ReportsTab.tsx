"use client";

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, RefreshCw, Flag, Bug, Database,
  ExternalLink, ChevronDown, ChevronUp, ImageIcon,
} from 'lucide-react';
import { type UserReport, CORRECTABLE_FIELDS } from '@/types/reports';

interface Props {
  password: string;
}

type FilterStatus = 'pending' | 'approved' | 'rejected';

export function ReportsTab({ password }: Props) {
  const [reports, setReports]   = useState<UserReport[]>([]);
  const [loading, setLoading]   = useState(false);
  const [filter, setFilter]     = useState<FilterStatus>('pending');
  const [expandedId, setExpId]  = useState<string | null>(null);
  const [busyId, setBusyId]     = useState<string | null>(null);
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const fetchReports = useCallback(async (status: FilterStatus) => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setReports(data.reports ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load', false);
    } finally {
      setLoading(false);
    }
  }, [password]);

  useEffect(() => { fetchReports(filter); }, [filter, fetchReports]);

  async function resolve(reportId: string, action: 'approve' | 'reject') {
    setBusyId(reportId);
    try {
      const res  = await fetch('/api/admin/reports/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, reportId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setReports(r => r.filter(x => x.id !== reportId));
      showToast(action === 'approve' ? 'Correction applied.' : 'Report rejected.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', false);
    } finally {
      setBusyId(null);
    }
  }

  const corrections = reports.filter(r => r.type === 'data_correction');
  const bugReports  = reports.filter(r => r.type === 'bug_report');

  return (
    <div className="space-y-6">

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0 border border-neutral-800">
          {(['pending', 'approved', 'rejected'] as FilterStatus[]).map(s => (
            <button
              key={s}
              onClick={() => { setFilter(s); setExpId(null); }}
              className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                filter === s
                  ? 'bg-[#F59E0B] text-black font-black'
                  : 'text-neutral-500 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => fetchReports(filter)}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 border border-neutral-800 text-neutral-400 font-mono text-[10px] uppercase hover:bg-neutral-900 hover:text-white disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {loading && (
        <div className="py-16 text-center font-mono text-xs text-neutral-600 uppercase animate-pulse tracking-widest">
          Loading reports…
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!loading && reports.length === 0 && (
        <div className="py-16 text-center">
          <Flag size={24} className="mx-auto text-neutral-700 mb-3" />
          <p className="font-mono text-xs text-neutral-600 uppercase tracking-widest">
            No {filter} reports
          </p>
        </div>
      )}

      {/* ── Data Corrections ────────────────────────────────────────────── */}
      {!loading && corrections.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Database size={12} className="text-[#00E5FF]" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              Data Corrections ({corrections.length})
            </span>
          </div>

          <div className="space-y-1">
            {corrections.map(r => (
              <ReportRow
                key={r.id}
                report={r}
                expanded={expandedId === r.id}
                busy={busyId === r.id}
                isPending={filter === 'pending'}
                onToggle={() => setExpId(expandedId === r.id ? null : r.id)}
                onApprove={() => resolve(r.id, 'approve')}
                onReject={() => resolve(r.id, 'reject')}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Bug Reports ─────────────────────────────────────────────────── */}
      {!loading && bugReports.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Bug size={12} className="text-[#FF3D00]" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              Bug Reports ({bugReports.length})
            </span>
          </div>

          <div className="space-y-1">
            {bugReports.map(r => (
              <ReportRow
                key={r.id}
                report={r}
                expanded={expandedId === r.id}
                busy={busyId === r.id}
                isPending={filter === 'pending'}
                onToggle={() => setExpId(expandedId === r.id ? null : r.id)}
                onApprove={() => resolve(r.id, 'approve')}
                onReject={() => resolve(r.id, 'reject')}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Toast ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 48, opacity: 0 }}
            className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 border font-mono text-xs uppercase tracking-widest ${
              toast.ok
                ? 'bg-[#0a0a0a] border-[#76FF03] text-[#76FF03]'
                : 'bg-[#0a0a0a] border-[#FF3D00] text-[#FF3D00]'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Single report row ────────────────────────────────────────────────────────

interface RowProps {
  report: UserReport;
  expanded: boolean;
  busy: boolean;
  isPending: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
}

function ReportRow({ report, expanded, busy, isPending, onToggle, onApprove, onReject }: RowProps) {
  const isCorrection = report.type === 'data_correction';
  const fieldLabel   = isCorrection
    ? (CORRECTABLE_FIELDS[report.field_name ?? ''] ?? report.field_name ?? '—')
    : null;

  return (
    <div className="border border-neutral-800 bg-[#111]">
      {/* Summary row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#0a0a0a] transition-colors"
      >
        {isCorrection
          ? <Database size={11} className="text-[#00E5FF] shrink-0" />
          : <Bug size={11} className="text-[#FF3D00] shrink-0" />
        }

        <span className="font-black text-xs text-white truncate flex-1">
          {report.event_name ?? `Event #${report.event_id ?? '?'}`}
        </span>

        {isCorrection && (
          <>
            <span className="font-mono text-[10px] text-neutral-500 shrink-0">{fieldLabel}</span>
            <span className="font-mono text-[10px] text-[#00E5FF] truncate max-w-[140px] shrink-0">
              → {report.proposed_value}
            </span>
          </>
        )}

        <span className="font-mono text-[10px] text-neutral-700 shrink-0">
          {new Date(report.created_at).toLocaleDateString()}
        </span>

        {expanded ? <ChevronUp size={11} className="text-neutral-600 shrink-0" /> : <ChevronDown size={11} className="text-neutral-600 shrink-0" />}
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-neutral-800 space-y-4">

              {isCorrection ? (
                <div className="grid grid-cols-3 gap-3">
                  <DetailCell label="Event ID"       value={String(report.event_id ?? '—')} />
                  <DetailCell label="Field"          value={fieldLabel ?? '—'} />
                  <DetailCell label="Proposed Value" value={report.proposed_value ?? '—'} accent />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="font-mono text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed">
                    {report.description}
                  </p>
                  {(report.screenshot_urls ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {report.screenshot_urls!.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 font-mono text-[10px] uppercase transition-colors"
                        >
                          <ImageIcon size={10} />
                          Screenshot {i + 1}
                          <ExternalLink size={9} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              {isPending && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={onApprove}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#76FF03]/10 border border-[#76FF03]/30 text-[#76FF03] font-black text-[10px] uppercase tracking-widest hover:bg-[#76FF03]/20 disabled:opacity-50 transition-colors"
                  >
                    {busy ? <RefreshCw size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                    {isCorrection ? 'Approve & Apply' : 'Mark Resolved'}
                  </button>
                  <button
                    onClick={onReject}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#FF3D00]/10 border border-[#FF3D00]/30 text-[#FF3D00] font-black text-[10px] uppercase tracking-widest hover:bg-[#FF3D00]/20 disabled:opacity-50 transition-colors"
                  >
                    {busy ? <RefreshCw size={10} className="animate-spin" /> : <XCircle size={10} />}
                    Deny
                  </button>
                  <span className="font-mono text-[10px] text-neutral-700 ml-auto">
                    ID: {report.id.slice(0, 8)}…
                  </span>
                </div>
              )}

              {!isPending && (
                <div className="flex items-center gap-2 pt-1">
                  <span className={`font-mono text-[10px] uppercase tracking-widest ${
                    report.status === 'approved' ? 'text-[#76FF03]' : 'text-[#FF3D00]'
                  }`}>
                    {report.status} {report.resolved_at ? `· ${new Date(report.resolved_at).toLocaleDateString()}` : ''}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-600 mb-1">{label}</p>
      <p className={`font-mono text-xs ${accent ? 'text-[#00E5FF]' : 'text-neutral-300'}`}>{value}</p>
    </div>
  );
}
