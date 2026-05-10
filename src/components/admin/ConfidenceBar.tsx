"use client";

interface Props {
  score: number | null;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export function confidenceColor(score: number | null): string {
  if (score === null) return '#404040';
  if (score >= 0.85) return '#76FF03';
  if (score >= 0.65) return '#F59E0B';
  return '#FF3D00';
}

export function confidenceLabel(score: number | null): string {
  if (score === null) return 'N/A';
  if (score >= 0.85) return 'HIGH';
  if (score >= 0.65) return 'MED';
  return 'LOW';
}

export function ConfidenceBar({ score, showLabel = true, size = 'md', animated = true }: Props) {
  const color = confidenceColor(score);
  const pct   = score !== null ? Math.round(score * 100) : 0;

  const heights: Record<string, string> = { sm: 'h-0.5', md: 'h-1', lg: 'h-1.5' };
  const trackH = heights[size] ?? 'h-1';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-neutral-800 ${trackH} overflow-hidden`}>
        <div
          className={`h-full ${animated ? 'transition-all duration-500' : ''}`}
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && (
        <span
          className="font-mono text-[10px] tabular-nums w-[2.8rem] text-right shrink-0"
          style={{ color }}
        >
          {score !== null ? score.toFixed(2) : '—'}
        </span>
      )}
    </div>
  );
}

export function ConfidencePill({ score }: { score: number | null }) {
  const color = confidenceColor(score);
  const label = confidenceLabel(score);
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-black font-mono uppercase tracking-widest border"
      style={{ color, borderColor: `${color}40`, backgroundColor: `${color}10` }}
    >
      {label}
    </span>
  );
}
