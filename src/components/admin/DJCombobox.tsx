"use client";

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface DJComboboxProps {
  selected: string[];
  onChange: (djs: string[]) => void;
}

export function DJCombobox({ selected, onChange }: DJComboboxProps) {
  const [allDJs, setAllDJs] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/admin/djs')
      .then(res => res.json())
      .then(data => setAllDJs(data.djs ?? []));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = allDJs
    .filter(dj => !selected.includes(dj))
    .filter(dj => !query || dj.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 20);

  const showAddOption =
    query.trim() !== '' &&
    !allDJs.some(dj => dj.toLowerCase() === query.toLowerCase()) &&
    !selected.includes(query.trim());

  const addDJ = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
    }
    setQuery('');
    inputRef.current?.focus();
  };

  const removeDJ = (name: string) => {
    onChange(selected.filter(dj => dj !== name));
  };

  return (
    <div ref={containerRef} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map(dj => (
            <span
              key={dj}
              className="flex items-center gap-1 bg-[#00E5FF]/10 border border-[#00E5FF] text-[#00E5FF] text-xs font-mono px-2 py-1"
            >
              {dj}
              <button type="button" onClick={() => removeDJ(dj)} className="hover:text-white ml-0.5">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Search or add DJ..."
        className="w-full bg-[#1a1a1a] border-2 border-neutral-700 text-white p-2 font-mono text-sm focus:border-[#00E5FF] outline-none placeholder:text-neutral-600"
      />

      {isOpen && (filtered.length > 0 || showAddOption) && (
        <div className="absolute z-50 w-full mt-1 bg-[#111] border-2 border-neutral-700 max-h-48 overflow-y-auto">
          {filtered.map(dj => (
            <button
              key={dj}
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                addDJ(dj);
              }}
              className="w-full text-left px-3 py-2 text-sm font-mono text-white hover:bg-neutral-800"
            >
              {dj}
            </button>
          ))}
          {showAddOption && (
            <button
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                addDJ(query);
              }}
              className="w-full text-left px-3 py-2 text-sm font-mono text-[#76FF03] hover:bg-neutral-800 border-t border-neutral-700"
            >
              + Add &ldquo;{query.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
