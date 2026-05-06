"use client";

import { useState } from 'react';
import { X, Save, CheckCircle, Loader, ExternalLink } from 'lucide-react';
import { ImageGridSelector } from './ImageGridSelector';
import { DJCombobox } from './DJCombobox';

// Covers both pending_events and live events rows uniformly
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
  // only present on pending events
  carousel_images: string[] | null;
  source: string | null;
  status: string | null;
  created_at: string | null;
}

// Backwards-compat alias used by the page
export type PendingEvent = AdminEvent;

interface EditEventModalProps {
  event: AdminEvent;
  password: string;
  /** 'pending' shows the Approve button and saves to pending_events.
   *  'live' hides Approve and saves directly to the events table. */
  mode: 'pending' | 'live';
  onClose: () => void;
  onSuccess: (id: string, action: 'saved' | 'approved', updatedFields?: Partial<AdminEvent>) => void;
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
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = saving || approving;

  const setField = (key: keyof FormState, value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  const patchEvent = () => {
    if (mode === 'live') {
      return fetch('/api/admin/update-live', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, eventId: event.id, fields: form }),
      });
    }
    return fetch('/api/admin/update-pending', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, pendingEventId: event.id, fields: form }),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await patchEvent();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Save failed');
      onSuccess(event.id, 'saved', form);
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
      // Flush edits first so approve-event reads the latest state
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-[#111] border-2 border-neutral-700 shadow-[8px_8px_0px_#000] max-h-[90vh] flex flex-col">

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
                href={event.ig_post_url}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Event Name">
              <input
                className={inputCls}
                value={form.event_name}
                onChange={e => setField('event_name', e.target.value)}
              />
            </Field>
            <Field label="Club / Venue">
              <input
                className={inputCls}
                value={form.club_name}
                onChange={e => setField('club_name', e.target.value)}
              />
            </Field>
            <Field label="City">
              <input
                className={inputCls}
                value={form.city}
                onChange={e => setField('city', e.target.value)}
              />
            </Field>
            <Field label="Event Date">
              <input
                type="date"
                className={inputCls}
                value={form.event_date}
                onChange={e => setField('event_date', e.target.value)}
              />
            </Field>
          </div>

          <Field label="DJ Name (display text)">
            <input
              className={inputCls}
              placeholder="e.g. DJ A, DJ B"
              value={form.dj_name}
              onChange={e => setField('dj_name', e.target.value)}
            />
          </Field>

          <Field label="DJs (searchable tags)">
            <DJCombobox
              selected={form.djs}
              onChange={djs => setForm(f => ({ ...f, djs }))}
            />
          </Field>

          {/* Carousel picker — only present on pending/AI events */}
          {(event.carousel_images?.length ?? 0) > 0 && (
            <Field label="Select Flyer Image">
              <ImageGridSelector
                carouselImages={event.carousel_images!}
                selectedUrl={form.image_url || null}
                onChange={url => setField('image_url', url)}
              />
            </Field>
          )}

          <Field label="Image URL">
            <input
              className={`${inputCls} font-mono text-xs`}
              placeholder="https://..."
              value={form.image_url}
              onChange={e => setField('image_url', e.target.value)}
            />
          </Field>

          {error && (
            <p className="text-[#FF3D00] font-mono text-xs border border-[#FF3D00]/60 bg-[#FF3D00]/5 px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-neutral-800 shrink-0">
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

// ─── helpers ───────────────────────────────────────────────────────────────

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
