"use client";

import { useState } from 'react';
import { ChevronDown, ExternalLink, Bot, FileText, ScanText, AlertCircle } from 'lucide-react';
import { ConfidenceBar, confidenceColor, confidenceLabel } from './ConfidenceBar';
import type { AdminPendingEvent } from '@/types/admin';

interface Props {
  event: AdminPendingEvent;
}

export function AIContextPanel({ event }: Props) {
  const [captionOpen, setCaptionOpen] = useState(false);
  const [ocrOpen,     setOcrOpen]     = useState(false);

  const color = confidenceColor(event.confidence_score);
  const label = confidenceLabel(event.confidence_score);

  return (
    <div className="flex flex-col gap-3 text-[11px]">

      {/* Confidence */}
      <div className="bg-[#0a0a0a] border border-neutral-800 p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] text-neutral-500 uppercase tracking-widest">AI Confidence</span>
          <span className="font-black text-xs uppercase tracking-wide" style={{ color }}>{label}</span>
        </div>
        <ConfidenceBar score={event.confidence_score} size="lg" />
        <div className="flex items-center justify-between mt-0.5">
          <span className="font-mono text-[10px] text-neutral-600">
            {event.parse_method ?? 'unknown method'}
          </span>
          {event.confidence_score !== null && (
            <span className="font-mono text-xs tabular-nums" style={{ color }}>
              {Math.round(event.confidence_score * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* Source */}
      {event.source_username && (
        <div className="flex items-center justify-between bg-[#0a0a0a] border border-neutral-800 px-3 py-2">
          <div className="flex items-center gap-1.5 text-neutral-400">
            <Bot size={11} />
            <span className="font-mono text-[10px]">@{event.source_username}</span>
          </div>
          {event.ig_post_url && (
            <a
              href={event.ig_post_url.split('#')[0]}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-neutral-600 hover:text-[#00E5FF] transition-colors"
            >
              <ExternalLink size={10} />
              <span className="font-mono text-[9px] uppercase">View Post</span>
            </a>
          )}
        </div>
      )}

      {/* Scraper notes */}
      {event.scraper_notes && (
        <div className="flex items-start gap-2 bg-[#0a0a0a] border border-[#F59E0B]/30 px-3 py-2">
          <AlertCircle size={11} className="text-[#F59E0B] shrink-0 mt-0.5" />
          <p className="font-mono text-[10px] text-[#F59E0B] leading-relaxed">{event.scraper_notes}</p>
        </div>
      )}

      {/* Raw Caption */}
      {event.raw_caption && (
        <Collapsible
          icon={<FileText size={11} />}
          label="Raw Caption"
          open={captionOpen}
          onToggle={() => setCaptionOpen(x => !x)}
        >
          <p className="font-mono text-[10px] text-neutral-400 leading-relaxed whitespace-pre-wrap break-words">
            {event.raw_caption}
          </p>
        </Collapsible>
      )}

      {/* OCR Text */}
      {event.ocr_text && (
        <Collapsible
          icon={<ScanText size={11} />}
          label="OCR Text"
          open={ocrOpen}
          onToggle={() => setOcrOpen(x => !x)}
        >
          <p className="font-mono text-[10px] text-neutral-400 leading-relaxed whitespace-pre-wrap break-words">
            {event.ocr_text}
          </p>
        </Collapsible>
      )}

    </div>
  );
}

function Collapsible({
  icon, label, open, onToggle, children,
}: {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0a0a0a] border border-neutral-800 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-900 transition-colors"
      >
        <div className="flex items-center gap-1.5 text-neutral-500">
          {icon}
          <span className="font-mono text-[9px] uppercase tracking-widest">{label}</span>
        </div>
        <ChevronDown
          size={11}
          className={`text-neutral-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-3 pb-3 max-h-40 overflow-y-auto border-t border-neutral-800">
          {children}
        </div>
      )}
    </div>
  );
}
