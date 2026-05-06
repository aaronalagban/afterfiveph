"use client";

import { useState, useCallback } from 'react';
import { X, Save, CheckCircle, Loader, ExternalLink, ImageOff, ScanSearch, Trash2 } from 'lucide-react';
import { ImageGridSelector } from './ImageGridSelector';
import { DJCombobox } from './DJCombobox';

export interface AdminEvent {
  id: string;
  event_name: string;
  dj_name: string | null;
  club_name: string;
  city: string | null;
  event_date: string;
  image_url: string | null;
  ig_post_url: string | null;
  djs: string[] | null;
  carousel_images: string[] | null;
  source: string | null;
  status: string | null;
  created_at: string | null;
}

export type PendingEvent = AdminEvent;

interface EditEventModalProps {
  event: AdminEvent;
  password: string;
  mode: 'pending' | 'live';
  onClose: () => void;
  onSuccess: (
    id: string,
    action: 'saved' | 'approved' | 'deleted',
    updatedFields?: Partial<AdminEvent>
  ) => void;
}

type FormState = {
  event_name: string;
  dj_name: string;
  club_name: string;
  city: string;
  event_date: string;
  image_url: string;
  djs: string[];
};

export function EditEventModal({ event, password, mode, onClose, onSuccess }: EditEventModalProps) {
  const [form, setForm] = useState<FormState>({
    event_name: event.event_name ?? '',
    dj_name: event.dj_name ?? '',
    club_name: event.club_name ?? '',
    city: event.city ?? '',
    event_date: event.event_date ?? '',
    image_url: event.image_url ?? '',
    djs: event.djs ?? [],
  });

  const [localCarousel, setLocalCarousel] = useState<string[]>(event.carousel_images ?? []);
  const [fetchingCarousel, setFetchingCarousel] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [posterError, setPosterError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = saving || approving || deleting || fetchingCarousel;
  const hasCarousel = localCarousel.length > 0;
  const canFetch = !!event.ig_post_url && !hasCarousel;

  // Resets poster error state whenever the URL changes
  const handleImageUrlChange = useCallback((url: string) => {
    setPosterError(false);
    setForm(f => ({ ...f, image_url: url }));
  }, []);

  const setField = (key: keyof FormState, value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  // ── Carousel fetcher ──────────────────────────────────────────────────────

  const fetchCarousel = async () => {
    setFetchingCarousel(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/admin/fetch-carousel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, igPostUrl: event.ig_post_url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Fetch failed');
      if (!data.images?.length) throw new Error('No images found in this post.');
      setLocalCarousel(data.images as string[]);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setFetchingCarousel(false);
    }
  };

  // ── Patch (always includes carousel_images if present) ───────────────────

  const patchEvent = () => {
    const fields = {
      ...form,
      ...(localCarousel.length > 0 ? { carousel_images: localCarousel } : {}),
    };
    if (mode === 'live') {
      return fetch('/api/admin/update-live', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, eventId: event.id, fields }),
      });
    }
    return fetch('/api/admin/update-pending', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, pendingEventId: event.id, fields }),
    });
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await patchEvent();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Save failed');

      const finalFields: Partial<AdminEvent> = {
        ...form,
        ...(data.image_url ? { image_url: data.image_url as string } : {}),
        ...(localCarousel.length > 0 ? { carousel_images: localCarousel } : {}),
      };

      onSuccess(event.id, 'saved', finalFields);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!form.image_url.trim()) {
      setError('An image URL is required before publishing.');
      return;
    }
    setApproving(true);
    setError(null);
    try {
      const patchRes = await patchEvent();
      if (!patchRes.ok) {
        const d = await patchRes.json();
        throw new Error(d.message ?? 'Could not save edits');
      }
      const res = await fetch('/api/admin/approve-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, pendingEventId: event.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Approve failed');
      onSuccess(event.id, 'approved');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setApproving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${form.event_name}"?\n\nThis cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const table = mode === 'live' ? 'events' : 'pending_events';
      const res = await fetch('/api/admin/delete-event', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, table, id: event.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Delete failed');
      onSuccess(event.id, 'deleted');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-3xl bg-[#111] border-2 border-neutral-700 shadow-[8px_8px_0px_#000] max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-lg uppercase text-[#00E5FF] tracking-tight leading-none">
                Edit Event
              </h2>
              {mode === 'live' && (
                <span className="px-1.5 py-0.5 text-[9px] font-black font-mono uppercase bg-[#76FF03]/10 border border-[#76FF03]/40 text-[#76FF03]">
                  Live
                </span>
              )}
            </div>
            {event.ig_post_url && (
              <a
                href={event.ig_post_url.split('#')[0]}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 mt-1 text-neutral-500 hover:text-white font-mono text-[10px] transition-colors"
              >
                View IG Post <ExternalLink size={10} />
              </a>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-neutral-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-6 flex flex-col gap-5">

          {/* Text fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Event Name">
              <input className={inputCls} value={form.event_name}
                onChange={e => setField('event_name', e.target.value)} />
            </Field>
            <Field label="Club / Venue">
              <input className={inputCls} value={form.club_name}
                onChange={e => setField('club_name', e.target.value)} />
            </Field>
            <Field label="City">
              <input className={inputCls} value={form.city}
                onChange={e => setField('city', e.target.value)} />
            </Field>
            <Field label="Event Date">
              <input type="date" className={inputCls} value={form.event_date}
                onChange={e => setField('event_date', e.target.value)} />
            </Field>
          </div>

          <Field label="DJ Name (display text)">
            <input className={inputCls} placeholder="e.g. DJ A, DJ B"
              value={form.dj_name} onChange={e => setField('dj_name', e.target.value)} />
          </Field>

          <Field label="DJs (searchable tags)">
            <DJCombobox selected={form.djs} onChange={djs => setForm(f => ({ ...f, djs }))} />
          </Field>

          {/* ── Image section — vertical stack ─────────────────────────────── */}
          <div className="flex flex-col gap-3">

            {/* Large Current Poster preview — updates instantly on carousel click */}
            <Field label="Current Poster">
              <div className="w-full h-[360px] bg-neutral-900 border-2 border-neutral-600 flex items-center justify-center overflow-hidden">
                {form.image_url && !posterError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={form.image_url}
                    src={form.image_url}
                    alt="Current poster"
                    referrerPolicy="no-referrer"
                    onError={() => setPosterError(true)}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-neutral-600">
                    <ImageOff size={32} />
                    <span className="font-mono text-xs uppercase">
                      {posterError ? 'Load failed' : 'No Image'}
                    </span>
                  </div>
                )}
              </div>
            </Field>

            {/* Carousel grid (full width now that it's stacked) */}
            {hasCarousel ? (
              <Field label="Select from Carousel — click to update preview above">
                <ImageGridSelector
                  carouselImages={localCarousel}
                  selectedUrl={form.image_url || null}
                  onChange={handleImageUrlChange}
                  cols={4}
                />
              </Field>
            ) : (
              <Field label="Carousel Slides">
                <div className="flex flex-col gap-2 border-2 border-dashed border-neutral-700 bg-neutral-900/40 p-5">
                  <p className="font-mono text-xs text-neutral-500">
                    {!canFetch
                      ? 'No IG URL stored — paste a URL in the field below.'
                      : fetchError
                      ? <span className="text-[#FF3D00]">{fetchError} — try again?</span>
                      : 'No slides cached. Fetch them from Instagram to pick the right poster.'}
                  </p>
                  {canFetch && (
                    <button
                      type="button"
                      onClick={fetchCarousel}
                      disabled={busy}
                      className="self-start flex items-center gap-2 px-4 py-2 border-2 border-neutral-600 text-white font-black uppercase text-xs hover:border-[#00E5FF] hover:text-[#00E5FF] disabled:opacity-40 transition-colors"
                    >
                      {fetchingCarousel ? (
                        <><Loader size={13} className="animate-spin" /> Fetching... (~15s)</>
                      ) : (
                        <><ScanSearch size={13} /> Fetch Carousel from Instagram</>
                      )}
                    </button>
                  )}
                </div>
              </Field>
            )}

            {/* Manual URL override */}
            <Field label="Image URL (manual override)">
              <input
                className={`${inputCls} font-mono text-xs`}
                placeholder="https://..."
                value={form.image_url}
                onChange={e => handleImageUrlChange(e.target.value)}
              />
            </Field>
          </div>

          {error && (
            <p className="text-[#FF3D00] font-mono text-xs border border-[#FF3D00]/60 bg-[#FF3D00]/5 px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-stretch gap-3 px-6 py-4 border-t border-neutral-800 shrink-0">
          {/* Delete — icon-only to save space */}
          <button
            onClick={handleDelete}
            disabled={busy}
            title="Delete this event"
            className="flex items-center justify-center px-3 border-2 border-[#FF3D00]/50 text-[#FF3D00] hover:bg-[#FF3D00] hover:text-black hover:border-[#FF3D00] disabled:opacity-40 transition-colors"
          >
            {deleting ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>

          <button
            onClick={handleSave}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-neutral-600 text-white font-black uppercase text-sm hover:bg-neutral-800 disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
            {mode === 'live' ? 'Save Changes' : 'Save Draft'}
          </button>

          {mode === 'pending' && (
            <button
              onClick={handleApprove}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-[#76FF03] text-[#76FF03] font-black uppercase text-sm hover:bg-[#76FF03] hover:text-black disabled:opacity-40 transition-colors"
            >
              {approving ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Approve &amp; Publish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

const inputCls =
  'w-full bg-[#1a1a1a] border-2 border-neutral-700 text-white p-2 font-mono text-sm focus:border-[#00E5FF] outline-none placeholder:text-neutral-600';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">{label}</span>
      {children}
    </div>
  );
}
