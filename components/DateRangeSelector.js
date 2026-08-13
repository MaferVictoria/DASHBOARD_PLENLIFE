'use client';

import { useState, useRef, useEffect } from 'react';
import { PRESETS, computeRangeForPreset } from '@/lib/dateRanges';

export default function DateRangeSelector({ range, onChange }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'custom'
  const [draftStart, setDraftStart] = useState(range.start);
  const [draftEnd, setDraftEnd] = useState(range.end);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setView('list');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectPreset(preset) {
    onChange({ id: preset.id, ...computeRangeForPreset(preset.id) });
    setOpen(false);
  }

  function openCustom() {
    setDraftStart(range.start);
    setDraftEnd(range.end);
    setView('custom');
  }

  function applyCustom() {
    if (!draftStart || !draftEnd) return;
    onChange({ id: 'custom', start: draftStart, end: draftEnd });
    setOpen(false);
    setView('list');
  }

  const currentLabel =
    range.id === 'custom'
      ? `${range.start} → ${range.end}`
      : PRESETS.find((p) => p.id === range.id)?.label || 'Seleccionar periodo';

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          setView('list');
        }}
        className="flex items-center gap-2 rounded-lg border border-line bg-panel px-4 py-2 font-display text-sm font-semibold text-brand shadow-sm"
      >
        {currentLabel}
        <span className="text-ink/40">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-line bg-panel py-2 shadow-lg">
          {view === 'list' ? (
            <>
              {PRESETS.map((preset) => {
                const selected = range.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => selectPreset(preset)}
                    className={[
                      'flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors',
                      selected ? 'bg-paper text-ink' : 'text-ink/80 hover:bg-paper',
                    ].join(' ')}
                  >
                    {preset.label}
                    {selected && <span className="text-brand">✓</span>}
                  </button>
                );
              })}
              <div className="my-1 border-t border-line" />
              <button
                onClick={openCustom}
                className={[
                  'flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors',
                  range.id === 'custom' ? 'bg-paper text-ink' : 'text-ink/80 hover:bg-paper',
                ].join(' ')}
              >
                Personalizado…
                {range.id === 'custom' && <span className="text-brand">✓</span>}
              </button>
            </>
          ) : (
            <div className="px-4 py-2">
              <label className="mb-1 block font-body text-[10px] uppercase tracking-wide text-ink/50">
                Desde
              </label>
              <input
                type="date"
                value={draftStart}
                onChange={(e) => setDraftStart(e.target.value)}
                className="mb-2 w-full rounded border border-line px-2 py-1 text-sm"
              />
              <label className="mb-1 block font-body text-[10px] uppercase tracking-wide text-ink/50">
                Hasta
              </label>
              <input
                type="date"
                value={draftEnd}
                onChange={(e) => setDraftEnd(e.target.value)}
                className="mb-3 w-full rounded border border-line px-2 py-1 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setView('list')}
                  className="flex-1 rounded border border-line py-1.5 text-sm text-ink/70"
                >
                  Volver
                </button>
                <button
                  onClick={applyCustom}
                  className="flex-1 rounded bg-brand py-1.5 text-sm font-medium text-white hover:bg-brand/90"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
