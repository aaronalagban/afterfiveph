"use client";

interface ImageGridSelectorProps {
  carouselImages: string[];
  selectedUrl: string | null;
  onChange: (url: string) => void;
}

export function ImageGridSelector({ carouselImages, selectedUrl, onChange }: ImageGridSelectorProps) {
  if (!carouselImages || carouselImages.length === 0) {
    return (
      <div className="border-2 border-dashed border-neutral-700 p-6 text-center text-neutral-500 font-mono text-sm">
        No carousel images stored for this post.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {carouselImages.map((url, i) => {
        const isSelected = selectedUrl === url;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(url)}
            className={`relative aspect-square overflow-hidden border-2 transition-all ${
              isSelected
                ? 'border-[#00E5FF] shadow-[0_0_0_2px_#00E5FF]'
                : 'border-neutral-700 hover:border-neutral-500'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
            {isSelected && (
              <div className="absolute inset-0 bg-[#00E5FF]/20 flex items-center justify-center">
                <span className="bg-[#00E5FF] text-black text-xs font-black px-1 leading-none py-0.5">
                  ✓
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
