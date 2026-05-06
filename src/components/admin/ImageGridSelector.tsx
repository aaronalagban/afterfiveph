"use client";

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface ImageGridSelectorProps {
  carouselImages: string[];
  selectedUrl: string | null;
  onChange: (url: string) => void;
  cols?: 2 | 3 | 4;
}

const colClass: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

export function ImageGridSelector({
  carouselImages,
  selectedUrl,
  onChange,
  cols = 3,
}: ImageGridSelectorProps) {
  if (!carouselImages || carouselImages.length === 0) {
    return (
      <div className="border-2 border-dashed border-neutral-700 p-6 text-center text-neutral-500 font-mono text-sm">
        No carousel images stored for this post.
      </div>
    );
  }

  return (
    <div className={`grid ${colClass[cols] ?? 'grid-cols-3'} gap-2`}>
      {carouselImages.map((url, i) => {
        const isSelected = selectedUrl === url;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(url)}
            className={`relative aspect-[3/4] overflow-hidden border-2 transition-all bg-neutral-900 ${
              isSelected
                ? 'border-[#00E5FF] shadow-[0_0_0_2px_#00E5FF]'
                : 'border-neutral-700 hover:border-neutral-500'
            }`}
          >
            <CarouselThumb url={url} index={i} />
            {isSelected && (
              <div className="absolute inset-0 bg-[#00E5FF]/20 flex items-center justify-center pointer-events-none">
                <span className="bg-[#00E5FF] text-black text-xs font-black px-1 leading-none py-0.5">
                  ✓
                </span>
              </div>
            )}
            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-mono px-1 pointer-events-none">
              {i + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Per-thumbnail with error state ────────────────────────────────────────

function CarouselThumb({ url, index }: { url: string; index: number }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  return (
    <>
      {/* Skeleton shown while loading */}
      {status === 'loading' && (
        <div className="absolute inset-0 bg-neutral-800 animate-pulse" />
      )}

      {/* Error placeholder */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-neutral-600 bg-neutral-800">
          <ImageOff size={18} />
          <span className="font-mono text-[9px] uppercase">Slide {index + 1}</span>
        </div>
      )}

      {/* The image — always in the DOM so onLoad/onError fire */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Slide ${index + 1}`}
        referrerPolicy="no-referrer"
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          status === 'loaded' ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </>
  );
}
