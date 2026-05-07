"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, Check, Loader2 } from "lucide-react";
import {
  generateLineupStory,
  filterThisWeek,
  type StoryEvent,
} from "./generateWeeklyStory";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "intro" | "select" | "generating";

interface Props {
  events: StoryEvent[];
  darkMode: boolean;
  onClose: () => void;
}

const MAX = 9;

const DAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  return `${DAY_SHORT[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}`;
}

// ── Share / download helper ───────────────────────────────────────────────────

async function shareOrDownload(blob: Blob) {
  const file = new File([blob], "weekly-lineup.jpg", { type: "image/jpeg" });
  try {
    if (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        files: [file],
        title: "This Week's Lineup",
        text: "Check out this week's events on AfterFivePH 🎶",
      });
      return;
    }
  } catch (err) {
    // AbortError = user dismissed share sheet — treat as cancel, not error
    if ((err as Error).name === "AbortError") return;
  }
  // Fallback: trigger browser download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "weekly-lineup.jpg";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function WeeklyLineupModal({ events, darkMode, onClose }: Props) {
  const [step, setStep] = useState<Step>("intro");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [genError, setGenError] = useState("");

  const weekEvents = filterThisWeek(events);
  const count = selected.size;
  const limitReached = count >= MAX;

  // Theme tokens
  const bg       = darkMode ? "bg-[#0B0B0D]"   : "bg-[#FFFFFF]";
  const surface  = darkMode ? "bg-[#111111]"   : "bg-[#F7F7F9]";
  const border   = darkMode ? "border-[#2A2A2E]" : "border-[#E5E5EA]";
  const text     = darkMode ? "text-[#FFFFFF]"  : "text-[#111111]";
  const muted    = darkMode ? "text-[#6E6E73]"  : "text-[#8C8C92]";
  const divider  = darkMode ? "bg-[#2A2A2E]"   : "bg-[#E5E5EA]";

  // ── Handlers ────────────────────────────────────────────────────────────────

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else if (!limitReached) {
        next.add(idx);
      }
      return next;
    });
  };

  const handleGenerate = async () => {
    if (count === 0) return;
    setGenError("");
    setStep("generating");

    // Sort by date order regardless of selection order
    const chosenEvents = Array.from(selected)
      .sort((a, b) => weekEvents[a].event_date.localeCompare(weekEvents[b].event_date))
      .map((idx) => weekEvents[idx]);

    try {
      const blob = await generateLineupStory(chosenEvents, darkMode);
      await shareOrDownload(blob);
      onClose();
    } catch {
      setGenError("Generation failed. Please try again.");
      setStep("select");
    }
  };

  // ── Layout ───────────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-end md:items-center md:justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={step === "generating" ? undefined : onClose}
      />

      {/* Panel — bottom sheet on mobile, centered card on desktop */}
      <motion.div
        className={`relative w-full md:max-w-md flex flex-col overflow-hidden border-t md:border ${border} ${bg} h-[92vh] md:h-auto md:max-h-[88vh]`}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
      >
        <AnimatePresence mode="wait">
          {step === "intro" && (
            <IntroStep
              key="intro"
              darkMode={darkMode}
              bg={bg} text={text} muted={muted} surface={surface} border={border} divider={divider}
              onClose={onClose}
              onNext={() => setStep("select")}
            />
          )}
          {step === "select" && (
            <SelectStep
              key="select"
              events={weekEvents}
              selected={selected}
              count={count}
              limitReached={limitReached}
              genError={genError}
              darkMode={darkMode}
              bg={bg} text={text} muted={muted} surface={surface} border={border} divider={divider}
              onBack={() => setStep("intro")}
              onToggle={toggle}
              onGenerate={handleGenerate}
            />
          )}
          {step === "generating" && (
            <GeneratingStep
              key="generating"
              text={text} muted={muted}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ── Step: Intro ───────────────────────────────────────────────────────────────

function IntroStep({
  onClose, onNext,
  bg, text, muted, surface, border,
}: {
  onClose: () => void;
  onNext: () => void;
  darkMode: boolean;
  bg: string; text: string; muted: string; surface: string; border: string; divider: string;
}) {
  return (
    <motion.div
      className="flex flex-col h-full"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      {/* Close */}
      <div className={`shrink-0 flex justify-end px-4 pt-4 pb-2`}>
        <button
          onClick={onClose}
          className={`p-2 border transition-colors ${border} ${muted} hover:text-[#F53D04] hover:border-[#F53D04]`}
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-1.png"
          alt="AfterFivePH"
          className="w-40 mb-10 opacity-90"
        />

        <h1 className={`font-black text-4xl uppercase tracking-tighter leading-none mb-5 ${text}`}>
          Your Week,<br />Curated.
        </h1>

        <p className={`font-mono text-sm leading-relaxed max-w-xs ${muted}`}>
          We value the art of the poster{" "}
          <span className="opacity-60">(and the sanity of graphic designers)</span>
          . To keep your story looking like a masterpiece, select your{" "}
          <strong className="font-bold text-[#F53D04]">Top 9</strong> must-attend
          events for the week.
        </p>
      </div>

      {/* CTA */}
      <div className="shrink-0 p-6">
        <button
          onClick={onNext}
          className="w-full py-4 bg-[#F53D04] text-white font-black text-sm uppercase tracking-widest hover:bg-[#FF5520] transition-colors"
        >
          Browse This Week →
        </button>
        <p className={`text-center font-mono text-[10px] mt-3 ${muted} uppercase tracking-widest`}>
          Mon – Sun · Current Week
        </p>
      </div>
    </motion.div>
  );
}

// ── Step: Select ──────────────────────────────────────────────────────────────

function SelectStep({
  events, selected, count, limitReached, genError,
  onBack, onToggle, onGenerate,
  bg, text, muted, surface, border, divider,
}: {
  events: StoryEvent[];
  selected: Set<number>;
  count: number;
  limitReached: boolean;
  genError: string;
  darkMode: boolean;
  bg: string; text: string; muted: string; surface: string; border: string; divider: string;
  onBack: () => void;
  onToggle: (idx: number) => void;
  onGenerate: () => void;
}) {
  return (
    <motion.div
      className="flex flex-col h-full"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className={`shrink-0 flex items-center justify-between px-4 py-3 border-b ${border}`}>
        <button
          onClick={onBack}
          className={`p-1.5 border transition-colors ${border} ${muted} hover:text-[#F53D04] hover:border-[#F53D04]`}
        >
          <ChevronLeft size={14} />
        </button>
        <span className={`font-black text-xs uppercase tracking-widest ${text}`}>
          This Week
        </span>
        <div className={`font-mono text-[10px] uppercase px-2 py-1 border ${border} ${muted}`}>
          {count}<span className="opacity-40">/{MAX}</span>
        </div>
      </div>

      {/* Limit banner */}
      <AnimatePresence>
        {limitReached && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 overflow-hidden"
          >
            <div className="px-4 py-2.5 bg-[#F53D04] text-white text-center font-mono text-[10px] uppercase tracking-widest">
              Lineup full. You&apos;ve picked the best of the best.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error banner */}
      {genError && (
        <div className={`shrink-0 px-4 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-[#F53D04] border-b ${border}`}>
          {genError}
        </div>
      )}

      {/* Scrollable grid */}
      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className={`flex items-center justify-center h-full font-mono text-sm ${muted} uppercase tracking-widest text-center p-8`}>
            No events this week.<br />Check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5 p-3">
            {events.map((event, idx) => {
              const isSelected = selected.has(idx);
              const disabled = limitReached && !isSelected;
              const dateLabel = formatDate(event.event_date);
              const nameLabel = (event.event_name || event.club_name || "Event")
                .toUpperCase()
                .slice(0, 18);

              return (
                <button
                  key={idx}
                  onClick={() => !disabled && onToggle(idx)}
                  className={`relative flex flex-col text-left border-2 transition-all duration-150 ${
                    isSelected
                      ? "border-[#F53D04]"
                      : `border-transparent`
                  } ${disabled ? "opacity-35 cursor-not-allowed" : "cursor-pointer active:scale-[0.97]"}`}
                >
                  {/* Poster */}
                  <div className={`w-full aspect-square overflow-hidden ${surface}`}>
                    {event.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={event.image_url}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center font-black text-xs ${muted}`}>
                        ?
                      </div>
                    )}
                  </div>

                  {/* Selected badge */}
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-[#F53D04] flex items-center justify-center">
                      <Check size={11} className="text-white" strokeWidth={3} />
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="pt-1 pb-1.5 px-0.5">
                    <div className="font-mono text-[8px] text-[#F53D04] uppercase leading-none">
                      {dateLabel}
                    </div>
                    <div className={`font-black text-[8.5px] uppercase leading-tight truncate mt-0.5 ${text}`}>
                      {nameLabel}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className={`shrink-0 h-px ${divider}`} />

      {/* Generate CTA */}
      <div className="shrink-0 p-4">
        <button
          onClick={onGenerate}
          disabled={count === 0}
          className="w-full py-4 bg-[#F53D04] text-white font-black text-sm uppercase tracking-widest hover:bg-[#FF5520] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {count === 0 ? "Select at least 1 event" : `Generate Story · ${count} Selected`}
        </button>
      </div>
    </motion.div>
  );
}

// ── Step: Generating ──────────────────────────────────────────────────────────

function GeneratingStep({ text, muted }: { text: string; muted: string }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full gap-6 px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Loader2 size={36} className="text-[#F53D04] animate-spin" strokeWidth={1.5} />
      <div className="text-center">
        <p className={`font-black text-xl uppercase tracking-tight ${text}`}>
          Crafting your masterpiece...
        </p>
        <p className={`font-mono text-[10px] uppercase tracking-widest mt-2 ${muted}`}>
          Rendering at 1080 × 1920
        </p>
      </div>
    </motion.div>
  );
}
