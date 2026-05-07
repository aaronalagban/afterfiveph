"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, Check, Loader2 } from "lucide-react";
import {
  generateLineupStory,
  filterThisWeek,
  getWeekBounds,
  formatWeekRange,
  STORY_THEMES,
  type StoryEvent,
  type StoryTheme,
  type StoryOptions,
  type DateMode,
} from "./generateWeeklyStory";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "intro" | "select" | "customize" | "generating";
type SubStep = "theme" | "title" | "date";

interface Props {
  events: StoryEvent[];
  darkMode: boolean;
  onClose: () => void;
}

const MAX = 9;
const DAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const SUB_STEPS: SubStep[] = ["theme", "title", "date"];
const SUB_LABELS = { theme: "Choose Theme", title: "Story Title", date: "Date Display" };

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
    if ((err as Error).name === "AbortError") return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "weekly-lineup.jpg";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Slide variants for sub-step transitions ───────────────────────────────────

const slide = {
  enter:  (d: number) => ({ x: d * 22, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d: number) => ({ x: -d * 22, opacity: 0 }),
};
const slideTransition = { duration: 0.18, ease: "easeInOut" as const };

// ── Modal root ────────────────────────────────────────────────────────────────

export default function WeeklyLineupModal({ events, darkMode, onClose }: Props) {
  const [step, setStep] = useState<Step>("intro");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [genError, setGenError] = useState("");

  // Customization studio state (persisted across sub-steps)
  const [studioTheme, setStudioTheme] = useState<StoryTheme>(STORY_THEMES[0]);
  const [customTitle, setCustomTitle] = useState("MY SCENE THIS WEEK");
  const [dateMode, setDateMode] = useState<DateMode>('range');

  const weekEvents = filterThisWeek(events);
  const count = selected.size;
  const limitReached = count >= MAX;

  const bg      = darkMode ? "bg-[#0B0B0D]"    : "bg-[#FFFFFF]";
  const surface = darkMode ? "bg-[#111111]"    : "bg-[#F7F7F9]";
  const border  = darkMode ? "border-[#2A2A2E]" : "border-[#E5E5EA]";
  const text    = darkMode ? "text-[#FFFFFF]"   : "text-[#111111]";
  const muted   = darkMode ? "text-[#6E6E73]"   : "text-[#8C8C92]";
  const divider = darkMode ? "bg-[#2A2A2E]"    : "bg-[#E5E5EA]";

  const toggle = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else if (!limitReached) next.add(idx);
      return next;
    });
  };

  const chosenEvents = Array.from(selected)
    .sort((a, b) => weekEvents[a].event_date.localeCompare(weekEvents[b].event_date))
    .map((idx) => weekEvents[idx]);

  const handleCommitGenerate = async () => {
    setGenError("");
    setStep("generating");
    const options: StoryOptions = {
      theme: studioTheme,
      customTitle: customTitle.trim() || "MY SCENE THIS WEEK",
      dateMode,
    };
    try {
      const blob = await generateLineupStory(chosenEvents, options);
      await shareOrDownload(blob);
      onClose();
    } catch {
      setGenError("Generation failed. Please try again.");
      setStep("customize");
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-end md:items-center md:justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={step === "generating" ? undefined : onClose}
      />
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
              onGenerate={() => { if (count > 0) { setGenError(""); setStep("customize"); } }}
            />
          )}
          {step === "customize" && (
            <CustomizeStep
              key="customize"
              chosenEvents={chosenEvents}
              darkMode={darkMode}
              studioTheme={studioTheme}
              customTitle={customTitle}
              dateMode={dateMode}
              genError={genError}
              bg={bg} text={text} muted={muted} surface={surface} border={border} divider={divider}
              onThemeChange={setStudioTheme}
              onTitleChange={(v) => setCustomTitle(v.toUpperCase())}
              onDateModeChange={setDateMode}
              onBackToSelect={() => setStep("select")}
              onGenerate={handleCommitGenerate}
            />
          )}
          {step === "generating" && (
            <GeneratingStep key="generating" text={text} muted={muted} />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ── Step: Intro ───────────────────────────────────────────────────────────────

function IntroStep({
  onClose, onNext, bg, text, muted, surface, border,
}: {
  onClose: () => void; onNext: () => void; darkMode: boolean;
  bg: string; text: string; muted: string; surface: string; border: string; divider: string;
}) {
  return (
    <motion.div className="flex flex-col h-full"
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
    >
      <div className="shrink-0 flex justify-end px-4 pt-4 pb-2">
        <button onClick={onClose}
          className={`p-2 border transition-colors ${border} ${muted} hover:text-[#F53D04] hover:border-[#F53D04]`}>
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-1.png" alt="AfterFivePH" className="w-40 mb-10 opacity-90" />
        <h1 className={`font-black text-4xl uppercase tracking-tighter leading-none mb-5 ${text}`}>
          Curate Your Week
        </h1>
        <p className={`font-mono text-sm leading-relaxed max-w-xs`}>
          Posters are part of the culture too. We cap it at{" "}
          <strong className="font-bold text-[#F53D04]">9</strong> so they still hit properly.
        </p>
      </div>
      <div className="shrink-0 p-6">
        <button onClick={onNext}
          className="w-full py-4 bg-[#F53D04] text-white font-black text-sm uppercase tracking-widest hover:bg-[#FF5520] transition-colors">
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
  events: StoryEvent[]; selected: Set<number>; count: number;
  limitReached: boolean; genError: string; darkMode: boolean;
  bg: string; text: string; muted: string; surface: string; border: string; divider: string;
  onBack: () => void; onToggle: (idx: number) => void; onGenerate: () => void;
}) {
  return (
    <motion.div className="flex flex-col h-full"
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}
    >
      <div className={`shrink-0 flex items-center justify-between px-4 py-3 border-b ${border}`}>
        <button onClick={onBack}
          className={`p-1.5 border transition-colors ${border} ${muted} hover:text-[#F53D04] hover:border-[#F53D04]`}>
          <ChevronLeft size={14} />
        </button>
        <span className={`font-black text-xs uppercase tracking-widest ${text}`}>This Week</span>
        <div className={`font-mono text-[10px] uppercase px-2 py-1 border ${border} ${muted}`}>
          {count}<span className="opacity-40">/{MAX}</span>
        </div>
      </div>

      <AnimatePresence>
        {limitReached && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="shrink-0 overflow-hidden">
            <div className="px-4 py-2.5 bg-[#F53D04] text-white text-center font-mono text-[10px] uppercase tracking-widest">
              Lineup full. You&apos;ve picked the best of the best.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {genError && (
        <div className={`shrink-0 px-4 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-[#F53D04] border-b ${border}`}>
          {genError}
        </div>
      )}

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
              const nameLabel = (event.event_name || event.club_name || "Event").toUpperCase().slice(0, 18);
              return (
                <button key={idx} onClick={() => !disabled && onToggle(idx)}
                  className={`relative flex flex-col text-left border-2 transition-all duration-150 ${
                    isSelected ? "border-[#F53D04]" : "border-transparent"
                  } ${disabled ? "opacity-35 cursor-not-allowed" : "cursor-pointer active:scale-[0.97]"}`}
                >
                  <div className={`w-full aspect-square overflow-hidden ${surface}`}>
                    {event.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={event.image_url} alt="" referrerPolicy="no-referrer"
                        className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center font-black text-xs ${muted}`}>?</div>
                    )}
                  </div>
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-[#F53D04] flex items-center justify-center">
                      <Check size={11} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                  <div className="pt-1 pb-1.5 px-0.5">
                    <div className="font-mono text-[8px] text-[#F53D04] uppercase leading-none">{dateLabel}</div>
                    <div className={`font-black text-[8.5px] uppercase leading-tight truncate mt-0.5 ${text}`}>{nameLabel}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={`shrink-0 h-px ${divider}`} />
      <div className="shrink-0 p-4">
        <button onClick={onGenerate} disabled={count === 0}
          className="w-full py-4 bg-[#F53D04] text-white font-black text-sm uppercase tracking-widest hover:bg-[#FF5520] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          {count === 0 ? "Select at least 1 event" : `Customise Story · ${count} Selected →`}
        </button>
      </div>
    </motion.div>
  );
}

// ── Step: Customize — 3-sub-step wizard ───────────────────────────────────────

function CustomizeStep({
  chosenEvents, darkMode, studioTheme, customTitle, dateMode, genError,
  onThemeChange, onTitleChange, onDateModeChange, onBackToSelect, onGenerate,
  text, muted, surface, border, divider,
}: {
  chosenEvents: StoryEvent[]; darkMode: boolean;
  studioTheme: StoryTheme; customTitle: string; dateMode: DateMode; genError: string;
  onThemeChange: (t: StoryTheme) => void; onTitleChange: (v: string) => void;
  onDateModeChange: (v: DateMode) => void; onBackToSelect: () => void; onGenerate: () => void;
  bg: string; text: string; muted: string; surface: string; border: string; divider: string;
}) {
  const [subStep, setSubStep] = useState<SubStep>("theme");
  const [dir, setDir] = useState(1);

  const { mondayStr, sundayStr } = getWeekBounds();
  const weekRangeLabel = formatWeekRange(mondayStr, sundayStr);

  const advance = (next: SubStep) => { setDir(1); setSubStep(next); };
  const retreat = () => {
    if (subStep === "theme") { onBackToSelect(); return; }
    setDir(-1);
    setSubStep(subStep === "date" ? "title" : "theme");
  };

  const inactiveDot = darkMode ? "#2A2A2E" : "#D5D5DA";

  return (
    <motion.div className="flex flex-col h-full"
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}
    >
      {/* ── Sub-header ── */}
      <div className={`shrink-0 flex items-center justify-between px-4 py-3 border-b ${border}`}>
        <button onClick={retreat}
          className={`p-1.5 border transition-colors ${border} ${muted} hover:text-[#F53D04] hover:border-[#F53D04]`}>
          <ChevronLeft size={14} />
        </button>

        {/* Animated step title */}
        <AnimatePresence mode="wait">
          <motion.span key={subStep}
            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.14 }}
            className={`font-black text-xs uppercase tracking-widest ${text}`}
          >
            {SUB_LABELS[subStep]}
          </motion.span>
        </AnimatePresence>

        {/* Step pill indicators */}
        <div className="flex items-center gap-1.5">
          {SUB_STEPS.map((s) => (
            <div key={s}
              className="h-1.5 transition-all duration-300"
              style={{
                width: s === subStep ? 16 : 6,
                background: s === subStep ? "#F53D04" : inactiveDot,
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Live Preview — stable across sub-steps ── */}
      <div
        className={`shrink-0 flex justify-center items-center py-5 border-b ${border}`}
        style={{ background: darkMode ? "#070709" : "#E4E4E8" }}
      >
        <StoryPreview
          events={chosenEvents}
          theme={studioTheme}
          customTitle={customTitle.trim() || "MY SCENE THIS WEEK"}
          dateMode={dateMode}
          weekRangeLabel={weekRangeLabel}
        />
      </div>

      {genError && (
        <div className={`shrink-0 px-4 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-[#F53D04] border-b ${border}`}>
          {genError}
        </div>
      )}

      {/* ── Animated sub-step controls ── */}
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={subStep}
          custom={dir}
          variants={slide}
          initial="enter"
          animate="center"
          exit="exit"
          transition={slideTransition}
          className="flex-1 flex flex-col min-h-0"
        >
          {subStep === "theme" && (
            <ThemeSubStep
              studioTheme={studioTheme}
              darkMode={darkMode}
              muted={muted}
              divider={divider}
              onThemeChange={onThemeChange}
              onNext={() => advance("title")}
            />
          )}
          {subStep === "title" && (
            <TitleSubStep
              customTitle={customTitle}
              onTitleChange={onTitleChange}
              onNext={() => advance("date")}
              text={text}
              muted={muted}
              border={border}
              divider={divider}
            />
          )}
          {subStep === "date" && (
            <DateSubStep
              dateMode={dateMode}
              weekRangeLabel={weekRangeLabel}
              darkMode={darkMode}
              onDateModeChange={onDateModeChange}
              onGenerate={onGenerate}
              text={text}
              muted={muted}
              border={border}
              divider={divider}
              surface={surface}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

// ── Sub-step: Theme ───────────────────────────────────────────────────────────

function ThemeSubStep({
  studioTheme, darkMode, muted, divider, onThemeChange, onNext,
}: {
  studioTheme: StoryTheme; darkMode: boolean; muted: string; divider: string;
  onThemeChange: (t: StoryTheme) => void; onNext: () => void;
}) {
  const inactiveOutline = darkMode ? "#2A2A2E" : "#E5E5EA";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 px-5 py-5">
        <p className={`font-mono text-[9px] uppercase tracking-[0.14em] mb-4 ${muted}`}>
          Select a visual theme
        </p>
        <div className="grid grid-cols-5 gap-2.5">
          {STORY_THEMES.map((theme) => {
            const isActive = studioTheme.id === theme.id;
            return (
              <button key={theme.id} onClick={() => onThemeChange(theme)}
                className="flex flex-col items-center gap-2" aria-pressed={isActive}>
                {/* Mini story-card swatch */}
                <div style={{
                  width: "100%", aspectRatio: "3 / 4", background: theme.bg,
                  outline: isActive ? "2px solid #F53D04" : `1px solid ${inactiveOutline}`,
                  outlineOffset: isActive ? "2px" : "0px",
                  display: "flex", flexDirection: "column",
                  padding: "5px 4px 4px", gap: "2px", boxSizing: "border-box",
                  transition: "outline 0.15s ease, outline-offset 0.15s ease",
                  cursor: "pointer",
                }}>
                  <div style={{ height: "2px", background: theme.muted, opacity: 0.7, flexShrink: 0 }} />
                  <div style={{
                    flex: 1, display: "grid",
                    gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr",
                    gap: "2px", minHeight: 0,
                  }}>
                    {[0, 1, 2, 3].map((n) => (
                      <div key={n} style={{ background: theme.cellBg }} />
                    ))}
                  </div>
                  <div style={{ height: "2.5px", background: theme.accent, flexShrink: 0 }} />
                </div>
                <span style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "7px", textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: isActive ? "#F53D04" : darkMode ? "#6E6E73" : "#8C8C92",
                  transition: "color 0.15s", lineHeight: 1.2, textAlign: "center",
                }}>
                  {theme.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className={`shrink-0 h-px ${divider}`} />
      <div className="shrink-0 p-4">
        <button onClick={onNext}
          className="w-full py-4 bg-[#F53D04] text-white font-black text-sm uppercase tracking-widest hover:bg-[#FF5520] transition-colors">
          Set Title →
        </button>
      </div>
    </div>
  );
}

// ── Sub-step: Title ───────────────────────────────────────────────────────────

function TitleSubStep({
  customTitle, onTitleChange, onNext, text, muted, border, divider,
}: {
  customTitle: string; onTitleChange: (v: string) => void; onNext: () => void;
  text: string; muted: string; border: string; divider: string;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 px-5 py-5">
        <p className={`font-mono text-[9px] uppercase tracking-[0.14em] mb-2.5 ${muted}`}>
          Enter a custom headline
        </p>
        <div className={`relative border transition-colors duration-150 ${border} focus-within:border-[#F53D04]`}>
          <input
            type="text"
            value={customTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="MY SCENE THIS WEEK"
            maxLength={28}
            autoFocus
            /* fontSize 16px is required — iOS Safari zooms on inputs with font-size < 16px */
            style={{ fontSize: "16px", fontFamily: "inherit" }}
            className={`w-full px-3 py-3 pr-14 bg-transparent outline-none font-black uppercase tracking-widest ${text} placeholder:opacity-25`}
          />
          <span className={`absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] tabular-nums pointer-events-none ${muted}`}>
            {customTitle.length}/28
          </span>
        </div>
        <p className={`font-mono text-[9px] mt-2.5 ${muted}`}>
          Default: "MY SCENE THIS WEEK"
        </p>
      </div>
      <div className={`shrink-0 h-px ${divider}`} />
      <div className="shrink-0 p-4">
        <button onClick={onNext}
          className="w-full py-4 bg-[#F53D04] text-white font-black text-sm uppercase tracking-widest hover:bg-[#FF5520] transition-colors">
          Set Date →
        </button>
      </div>
    </div>
  );
}

// ── Sub-step: Date ────────────────────────────────────────────────────────────

function DateSubStep({
  dateMode, weekRangeLabel, darkMode,
  onDateModeChange, onGenerate,
  text, muted, border, divider,
}: {
  dateMode: DateMode; weekRangeLabel: string; darkMode: boolean;
  onDateModeChange: (v: DateMode) => void; onGenerate: () => void;
  text: string; muted: string; border: string; divider: string; surface: string;
}) {
  const OPTIONS: { mode: DateMode; label: string; sub: string }[] = [
    { mode: 'range',   label: weekRangeLabel, sub: 'Week range' },
    { mode: 'generic', label: 'This Week',     sub: 'Generic label' },
    { mode: 'none',    label: 'No Date',       sub: 'Hidden from image' },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 px-5 py-4 flex flex-col justify-center gap-3">
        <p className={`font-mono text-[9px] uppercase tracking-[0.14em] ${muted}`}>
          Date label
        </p>

        {/* Compact bordered list — ~50px per row vs ~68px cards */}
        <div className={`border ${border} overflow-hidden`}>
          {OPTIONS.map(({ mode, label, sub }, i) => {
            const active = dateMode === mode;
            return (
              <button
                key={mode}
                onClick={() => onDateModeChange(mode)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ${
                  i < OPTIONS.length - 1 ? `border-b ${border}` : ""
                }`}
                style={active ? { background: "rgba(245,61,4,0.07)" } : {}}
              >
                {/* Square radio */}
                <div className={`w-3.5 h-3.5 border-2 shrink-0 flex items-center justify-center transition-all duration-150 ${
                  active ? "border-[#F53D04] bg-[#F53D04]" : "border-current opacity-30"
                }`}>
                  {active && <Check size={8} className="text-white" strokeWidth={3.5} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`font-black text-[13px] uppercase tracking-tight leading-snug truncate ${
                    active ? "text-[#F53D04]" : text
                  }`}>
                    {label}
                  </div>
                  <div className={`font-mono text-[9px] uppercase tracking-widest mt-0.5 ${muted}`}>
                    {sub}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`shrink-0 h-px ${divider}`} />
      <div className="shrink-0 p-4">
        <button onClick={onGenerate}
          className="w-full py-4 bg-[#F53D04] text-white font-black text-sm uppercase tracking-widest hover:bg-[#FF5520] active:scale-[0.99] transition-all duration-100">
          Generate &amp; Share →
        </button>
      </div>
    </div>
  );
}

// ── Live Preview ──────────────────────────────────────────────────────────────

function StoryPreview({
  events, theme, customTitle, dateMode, weekRangeLabel,
}: {
  events: StoryEvent[]; theme: StoryTheme;
  customTitle: string; dateMode: DateMode; weekRangeLabel: string;
}) {
  const count = events.length;
  const cols  = count === 1 ? 1 : count <= 4 ? 2 : 3;
  const rows  = count <= 2 ? 1 : count <= 4 ? 2 : 3;

  const PW   = 120;
  const PH   = Math.round(PW * (640 / 360)); // 213px — exact canvas aspect ratio
  const SIDE = 7;
  const GAP  = 3;

  const CELL_W    = cols === 1
    ? PW - SIDE * 2
    : Math.floor((PW - SIDE * 2 - GAP * (cols - 1)) / cols);
  const HEADER_H  = 32;
  const GRID_TOP  = HEADER_H + 1 + 5;
  const FOOTER_H  = 12;
  const TEXT_H    = 16;
  const GRID_AREA = PH - GRID_TOP - FOOTER_H;
  const IMAGE_H   = Math.max(18, Math.floor((GRID_AREA - GAP * (rows - 1)) / rows) - TEXT_H);
  const CELL_H    = IMAGE_H + TEXT_H;
  const gridBlockH  = rows * CELL_H + (rows - 1) * GAP;
  const gridOffsetY = count > 0 ? Math.max(0, Math.round((GRID_AREA - gridBlockH) / 2)) : 0;

  return (
    <div style={{
      width: PW, height: PH,
      background: theme.bg,
      border: `1px solid ${theme.sep}`,
      position: "relative", overflow: "hidden", flexShrink: 0,
      boxShadow: "0 16px 48px rgba(0,0,0,0.65)",
      transition: "background 0.22s ease, border-color 0.22s ease",
    }}>
      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-1.png" alt="" style={{
        position: "absolute", top: 7, left: SIDE,
        height: 12, width: "auto",
        filter: theme.bg === "#F5F5F5" ? "invert(1)" : "none",
        opacity: 0.9, display: "block",
        transition: "filter 0.22s",
      }} />

      {/* Title block */}
      <div style={{ position: "absolute", top: 5, right: SIDE, textAlign: "right", maxWidth: "58%" }}>
        <div style={{
          fontFamily: "ui-monospace, monospace", fontSize: 4, fontWeight: 900,
          textTransform: "uppercase", letterSpacing: "0.05em",
          color: theme.muted, lineHeight: 1.3,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          transition: "color 0.22s",
        }}>
          {customTitle}
        </div>
        {dateMode !== 'none' && (
          <div style={{
            fontFamily: "ui-monospace, monospace", fontSize: 5, fontWeight: 900,
            textTransform: "uppercase", letterSpacing: "0.04em",
            color: theme.accent, marginTop: 1, lineHeight: 1.3,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            transition: "color 0.22s",
          }}>
            {dateMode === 'range' ? weekRangeLabel : "THIS WEEK"}
          </div>
        )}
      </div>

      {/* Separator */}
      <div style={{
        position: "absolute", top: HEADER_H, left: SIDE, width: PW - SIDE * 2,
        height: 1, background: theme.sep, transition: "background 0.22s",
      }} />

      {/* Poster grid */}
      {events.slice(0, 9).map((event, i) => {
        const row      = Math.floor(i / cols);
        const rowStart = row * cols;
        const rowCount = Math.min(cols, count - rowStart);
        const colInRow = i - rowStart;
        const rowTotalW = rowCount * CELL_W + (rowCount - 1) * GAP;
        const x = Math.round(SIDE + (PW - SIDE * 2 - rowTotalW) / 2 + colInRow * (CELL_W + GAP));
        const y = GRID_TOP + gridOffsetY + row * (CELL_H + GAP);
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, width: CELL_W, height: CELL_H }}>
            <div style={{
              width: CELL_W, height: IMAGE_H,
              background: theme.cellBg, overflow: "hidden",
              transition: "background 0.22s",
            }}>
              {event.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={event.image_url} alt="" referrerPolicy="no-referrer"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              )}
            </div>
            <div style={{
              fontFamily: "ui-monospace, monospace", fontSize: 3.5, fontWeight: 700,
              textTransform: "uppercase", color: theme.accent,
              marginTop: 2, letterSpacing: "0.04em",
              whiteSpace: "nowrap", overflow: "hidden",
              lineHeight: 1.3, transition: "color 0.22s",
            }}>
              {formatDate(event.event_date)}
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <div style={{
        position: "absolute", bottom: 3, left: 0, width: PW, textAlign: "center",
        fontFamily: "ui-monospace, monospace", fontSize: 3, fontWeight: 500,
        textTransform: "uppercase", letterSpacing: "0.1em",
        color: theme.muted, transition: "color 0.22s",
      }}>
        @AFTERFIVEPH
      </div>
    </div>
  );
}

// ── Step: Generating ──────────────────────────────────────────────────────────

function GeneratingStep({ text, muted }: { text: string; muted: string }) {
  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-6 px-8"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
    >
      <Loader2 size={36} className="text-[#F53D04] animate-spin" strokeWidth={1.5} />
      <div className="text-center">
        <p className={`font-black text-xl uppercase tracking-tight ${text}`}>
          Cooking up your weekend...
        </p>
        <p className={`font-mono text-[10px] uppercase tracking-widest mt-2 ${muted}`}>
          Making sure nothing gets lost in the sauce.
        </p>
      </div>
    </motion.div>
  );
}
