'use client';

import { useState } from 'react';
import { PRESETS, getPresetRange } from '@/lib/dateRanges';

export default function DateRangeSelector({ range, onChange }) {
  const [customOpen, setCustomOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(range.start);
  const [draftEnd, setDraftEnd] = useState(range.end);

  function selectPreset(preset) {
    setCustomOpen(false);
    onChange({ id: preset.id, ...getPresetRange(preset.days) });
  }

  function applyCustom() {
    if (!draftStart || !draftEnd) return;
    onChange({ id: 'custom', start: draftStart, end: draftEnd });
    setCustomOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          onClick={() => selectPreset(preset)}
          className={[
            'rounded-full border px-3 py-1.5 font-body text-xs uppercase tracking-wide transition-colors',
            range.id === preset.id
              ? 'border-brand bg-brand text-white'
              : 'border-line bg-panel text-ink/70 hover:border-brand/50',
          ].join(' ')}
        >
          {preset.label}
        </button>
      ))}

      <div className="relative">
        <button
          onClick={() => setCustomOpen((v) => !v)}
          className={[
            'rounded-full border px-3 py-1.5 font-body text-xs uppercase tracking-wide transition-colors',
            range.id === 'custom'
              ? 'border-brand bg-brand text-white'
              : 'border-line bg-panel text-ink/70 hover:border-brand/50',
          ].join(' ')}
        >
          {range.id === 'custom' ? `${range.start} → ${range.end}` : 'Personalizado'}
        </button>

        {customOpen && (
          <div className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-line bg-panel p-3 shadow-lg">
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
            <button
              onClick={applyCustom}
              className="w-full rounded bg-brand py-1.5 text-sm font-medium text-white hover:bg-brand-light"
            >
              Aplicar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
