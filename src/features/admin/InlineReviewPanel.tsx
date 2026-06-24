"use client";

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Save, CheckCircle, Trash2, Loader, ScanSearch, ImageOff, X } from 'lucide-react';
import { DJCombobox } from '@/components/admin/DJCombobox';
import { ImageGridSelector } from '@/components/admin/ImageGridSelector';
import { AIContextPanel } from '@/components/admin/AIContextPanel';
import type { AdminPendingEvent, AdminLiveEvent } from '@/types/admin';
// TODO(fete-2026): temporary campaign import — remove with the rest of the
// Fête feature (see src/features/fete/fete.config.ts).
import { isFeteGuideActive } from '@/features/fete/fete.config';

// ─── Manila time helpers ───────────────────────────────────────────────────────

function toManilaHHMM(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const manilaMinutes = (d.getUTCHours() * 60 + d.getUTCMinutes() + 480) % 1440;
  const h = Math.floor(manilaMinutes / 60);
  const m = manilaMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildISO(date: string, hhmm: string): string | null {
  if (!date || !hhmm) return null;
  try {
    return new Date(`${date}T${hhmm}:00+08:00`).toISOString();
  } catch {
    return null;
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  event: AdminPendingEvent | AdminLiveEvent;
  mode: 'pending' | 'live';
  password: string;
  onPromoted?: (id: string) => void;
  onRejected?: (id: string) => void;
  onSaved: (id: string, fields: Partial<AdminPendingEvent>) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}

type FormState = {
  event_name: string;
  club_name: string;
  city: string;
  event_date: string;
  starts_at_time: string;
  ends_at_time: string;
  dj_name: string;
  djs: string[];
  image_url: string;
  // TODO(fete-2026): temporary campaign field — remove with the rest of the Fête feature.
  is_fete_2026: boolean;
};

const inputCls =
  'w-full bg-[#111] border border-neutral-700 text-white px-3 py-2 font-mono text-xs focus:border-[#00E5FF] focus:outline-none placeholder:text-neutral-600 transition-colors';

const labelCls = 'text-[9px] font-mono text-neutral-500 uppercase tracking-widest';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      {children}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function InlineReviewPanel({ event, mode, password, onPromoted, onRejected, onSaved, onDeleted, onClose }: Props) {
  const isPending = mode === 'pending';
  const asPending = event as AdminPendingEvent;

  const [form, setForm] = useState<FormState>({
    event_name:     event.event_name ?? '',
    club_name:      event.club_name  ?? '',
    city:           event.city       ?? '',
    event_date:     event.event_date ?? '',
    starts_at_time: toManilaHHMM(event.starts_at),
    ends_at_time:   toManilaHHMM(event.ends_at),
    dj_name:        event.dj_name    ?? '',
    djs:            event.djs        ?? [],
    image_url:      event.image_url  ?? '',
    is_fete_2026:   (event as AdminLiveEvent).is_fete_2026 ?? false,
  });

  const [carousel, setCarousel]           = useState<string[]>(event.carousel_images ?? []);
  const [posterError, setPosterError]     = useState(false);
  const [fetchingCar, setFetchingCar]     = useState(false);
  const [carError, setCarError]           = useState<string | null>(null);
  const [saving, setSaving]               = useState(false);
  const [promoting, setPromoting]         = useState(false);
  const [rejecting, setRejecting]         = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const busy = saving || promoting || rejecting || deleting || fetchingCar;

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    if (key === 'image_url') setPosterError(false);
  }, []);

  // Build the payload to send to API routes
  const buildPayload = useCallback((): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      event_name:  form.event_name,
      club_name:   form.club_name,
      city:        form.city,
      event_date:  form.event_date,
      dj_name:     form.dj_name,
      djs:         form.djs,
      image_url:   form.image_url,
    };
    if (carousel.length > 0) payload.carousel_images = carousel;
    if (form.starts_at_time) payload.starts_at = buildISO(form.event_date, form.starts_at_time);
    if (form.ends_at_time)   payload.ends_at   = buildISO(form.event_date, form.ends_at_time);
    // TODO(fete-2026): temporary campaign field — remove with the rest of the Fête feature.
    if (!isPending) payload.is_fete_2026 = form.is_fete_2026;
    return payload;
  }, [form, carousel, isPending]);

  const fetchCarousel = async () => {
    if (!event.ig_post_url) return;
    setFetchingCar(true);
    setCarError(null);
    try {
      const res  = await fetch('/api/admin/fetch-carousel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, igPostUrl: event.ig_post_url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Fetch failed');
      if (!data.images?.length) throw new Error('No images found in this post.');
      setCarousel(data.images as string[]);
    } catch (e) {
      setCarError(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setFetchingCar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const endpoint = isPending ? '/api/admin/update-pending' : '/api/admin/update-live';
      const body = isPending
        ? { password, pendingEventId: event.id, fields: buildPayload() }
        : { password, eventId: event.id, fields: buildPayload() };

      const res  = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Save failed');

      const saved = { ...buildPayload(), ...(data.image_url ? { image_url: data.image_url as string } : {}) };
      onSaved(event.id, saved as Partial<AdminPendingEvent>);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePromote = async () => {
    if (!form.image_url.trim()) { setError('An image URL is required before publishing.'); return; }
    setPromoting(true);
    setError(null);
    try {
      const res  = await fetch('/api/admin/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, pendingEventId: event.id, fields: buildPayload() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Promote failed');
      onPromoted?.(event.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Promote failed');
    } finally {
      setPromoting(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    setError(null);
    try {
      const res  = await fetch('/api/admin/update-pending', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, pendingEventId: event.id, fields: { status: 'REJECTED' } }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? 'Reject failed'); }
      onRejected?.(event.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setRejecting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Permanently delete "${form.event_name || 'this event'}"?`)) return;
    setDeleting(true);
    setError(null);
    try {
      const table = isPending ? 'pending_events' : 'events';
      const res   = await fetch('/api/admin/delete-event', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, table, id: event.id }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? 'Delete failed'); }
      onDeleted(event.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="border-t border-b border-neutral-700 bg-[#0d0d0d]"
    >
      <div className="p-4 flex flex-col lg:flex-row gap-4">

        {/* ── Left: Poster + Carousel ──────────────────────────────────── */}
        <div className="flex flex-col gap-3 lg:w-[200px] shrink-0">
          <div className="w-full h-[260px] bg-[#111] border border-neutral-700 overflow-hidden flex items-center justify-center">
            {form.image_url && !posterError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={form.image_url}
                src={form.image_url}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setPosterError(true)}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-neutral-700">
                <ImageOff size={28} />
                <span className="font-mono text-[9px] uppercase">{posterError ? 'Load failed' : 'No image'}</span>
              </div>
            )}
          </div>

          {carousel.length > 0 ? (
            <ImageGridSelector
              carouselImages={carousel}
              selectedUrl={form.image_url || null}
              onChange={url => { setField('image_url', url); setPosterError(false); }}
              cols={4}
            />
          ) : (
            event.ig_post_url && (
              <button
                type="button"
                onClick={fetchCarousel}
                disabled={busy}
                className="flex items-center justify-center gap-1.5 py-2 border border-dashed border-neutral-700 text-neutral-500 font-mono text-[10px] uppercase hover:border-[#00E5FF] hover:text-[#00E5FF] disabled:opacity-40 transition-colors"
              >
                {fetchingCar ? <Loader size={11} className="animate-spin" /> : <ScanSearch size={11} />}
                {fetchingCar ? 'Fetching…' : 'Fetch Carousel'}
              </button>
            )
          )}

          {carError && <p className="font-mono text-[10px] text-[#FF3D00]">{carError}</p>}

          <Field label="Image URL">
            <input
              className={`${inputCls} text-[10px]`}
              placeholder="https://..."
              value={form.image_url}
              onChange={e => setField('image_url', e.target.value)}
            />
          </Field>
        </div>

        {/* ── Center: Form ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3">
          <Field label="Event Name">
            <input className={inputCls} value={form.event_name}
              onChange={e => setField('event_name', e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Venue / Club">
              <input className={inputCls} value={form.club_name}
                onChange={e => setField('club_name', e.target.value)} />
            </Field>
            <Field label="City">
              <input className={inputCls} value={form.city}
                onChange={e => setField('city', e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Event Date">
              <input type="date" className={inputCls} value={form.event_date}
                onChange={e => setField('event_date', e.target.value)} />
            </Field>
            <Field label="Starts (MNL)">
              <input type="time" className={inputCls} value={form.starts_at_time}
                onChange={e => setField('starts_at_time', e.target.value)} />
            </Field>
            <Field label="Ends (MNL)">
              <input type="time" className={inputCls} value={form.ends_at_time}
                onChange={e => setField('ends_at_time', e.target.value)} />
            </Field>
          </div>

          <Field label="DJ display text">
            <input className={inputCls} placeholder="e.g. DJ A b2b DJ B"
              value={form.dj_name} onChange={e => setField('dj_name', e.target.value)} />
          </Field>

          <Field label="DJs (searchable)">
            <DJCombobox selected={form.djs} onChange={djs => setForm(f => ({ ...f, djs }))} />
          </Field>

          {/* TODO(fete-2026): temporary campaign control — remove with the rest of
              the Fête feature (see src/features/fete/fete.config.ts). Only shown
              while the campaign window is active. */}
          {!isPending && isFeteGuideActive() && (
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#cd1d1d]/60 bg-[#fdb903]/10 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_fete_2026}
                onChange={e => setField('is_fete_2026', e.target.checked)}
                className="accent-[#cd1d1d]"
              />
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#cd1d1d]">
                Include in Fête Guide
              </span>
            </label>
          )}
        </div>

        {/* ── Right: AI Context (pending only) ─────────────────────────── */}
        {isPending && (
          <div className="lg:w-[220px] shrink-0">
            <p className={`${labelCls} mb-2`}>AI Context</p>
            <AIContextPanel event={asPending} />
          </div>
        )}

      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 border border-[#FF3D00]/50 bg-[#FF3D00]/5 text-[#FF3D00] font-mono text-xs">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={12} /></button>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="flex items-stretch gap-2 px-4 py-3 border-t border-neutral-800">
        <button
          onClick={handleDelete}
          disabled={busy}
          title="Delete permanently"
          className="flex items-center justify-center w-9 border border-[#FF3D00]/40 text-[#FF3D00]/60 hover:bg-[#FF3D00] hover:text-black hover:border-[#FF3D00] disabled:opacity-40 transition-all"
        >
          {deleting ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>

        {isPending && (
          <button
            onClick={handleReject}
            disabled={busy}
            className="px-4 py-2 border border-neutral-700 text-neutral-500 font-black text-xs uppercase hover:border-neutral-500 hover:text-neutral-300 disabled:opacity-40 transition-colors"
          >
            {rejecting ? <Loader size={12} className="animate-spin" /> : 'Reject'}
          </button>
        )}

        <div className="flex-1" />

        <button
          onClick={handleSave}
          disabled={busy}
          className="flex items-center gap-2 px-5 py-2 border border-neutral-600 text-white font-black text-xs uppercase hover:bg-neutral-800 disabled:opacity-40 transition-colors"
        >
          {saving ? <Loader size={12} className="animate-spin" /> : <Save size={12} />}
          {isPending ? 'Save Draft' : 'Save Changes'}
        </button>

        {isPending && (
          <button
            onClick={handlePromote}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2 border-2 border-[#76FF03] text-[#76FF03] font-black text-xs uppercase hover:bg-[#76FF03] hover:text-black disabled:opacity-40 transition-all"
          >
            {promoting ? <Loader size={12} className="animate-spin" /> : <CheckCircle size={12} />}
            Approve &amp; Publish
          </button>
        )}
      </div>
    </motion.div>
  );
}
