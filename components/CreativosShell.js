'use client';

import { useEffect, useState } from 'react';
import { useDateRange } from './DateRangeProvider';
import DateRangeSelector from './DateRangeSelector';
import CreativeCardGrid from './CreativeCardGrid';
import SectionHeader from './SectionHeader';
import ErrorBanner from './ErrorBanner';
import { fetchJSON } from '@/lib/fetchJSON';

const AUDIENCE_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'Prospecting', label: 'Prospecting' },
  { id: 'Retargeting', label: 'Retargeting' },
  { id: 'Sin clasificar', label: 'Sin clasificar' },
];

// Keys must match CREATIVE_SORT_KEYS in lib/connectors/meta.js.
const SORT_OPTIONS = [
  { key: 'roas', label: 'ROAS' },
  { key: 'spend', label: 'Inversión' },
  { key: 'purchases', label: 'Compras' },
  { key: 'purchaseValue', label: 'Valor de compras' },
  { key: 'cpa', label: 'Costo por compra' },
  { key: 'uniqueCtr', label: 'CTR único' },
  { key: 'reach', label: 'Alcance' },
  { key: 'landingPageViews', label: 'Visitas a la página' },
  { key: 'addToCart', label: 'Añadidos al carrito' },
];

export default function CreativosShell() {
  const { range } = useDateRange();
  const [loading, setLoading] = useState(true);
  const [creatives, setCreatives] = useState([]);
  const [total, setTotal] = useState(0);
  const [errors, setErrors] = useState({ meta: null });
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [sortKey, setSortKey] = useState('roas');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({
      start: range.start,
      end: range.end,
      audience: audienceFilter,
      sort: sortKey,
      dir: sortDir,
    });

    fetchJSON(`/api/meta/creatives?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          setErrors({ meta: res.error });
          setCreatives([]);
          setTotal(0);
        } else {
          setErrors({ meta: null });
          setCreatives(res.creatives || []);
          setTotal(res.total ?? (res.creatives || []).length);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range.start, range.end, audienceFilter, sortKey, sortDir]);

  const sortLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label || 'ROAS';

  function handleSortChange(nextKey) {
    setSortKey(nextKey);
    // Costo por compra: lower is better, so it starts ascending.
    setSortDir(nextKey === 'cpa' ? 'asc' : 'desc');
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <header className="mb-6 border-b border-line pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Biblioteca de Creativos</h1>
            <p className="mt-1 text-sm text-ink/60">Rendimiento visual y financiero de los anuncios de Meta.</p>
          </div>
          <DateRangeSelector />
        </div>
      </header>

      <main className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
        <ErrorBanner errors={errors} />

        <SectionHeader eyebrow="Ranking" title={`Top creativos por ${sortLabel}`} note={`${range.start} → ${range.end}`} />

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setAudienceFilter(f.id)}
                className={[
                  'rounded-full border px-3 py-1.5 font-body text-xs uppercase tracking-wide transition-colors',
                  audienceFilter === f.id
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-panel text-ink/70 hover:border-brand/50',
                ].join(' ')}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="font-body text-[10px] uppercase tracking-wide text-ink/50" htmlFor="creative-sort">
              Ordenar por
            </label>
            <select
              id="creative-sort"
              value={sortKey}
              onChange={(e) => handleSortChange(e.target.value)}
              className="rounded border border-line bg-panel px-2 py-1.5 font-body text-xs text-ink"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
              title="Invertir el orden"
              className="rounded border border-line bg-panel px-2.5 py-1.5 font-body text-xs text-ink hover:border-brand/50"
            >
              {sortDir === 'desc' ? 'Mayor a menor ▼' : 'Menor a mayor ▲'}
            </button>
          </div>
        </div>

        <p className="mb-4 font-body text-sm text-ink/60">
          Mostrando {creatives.length} de {total} anuncios
        </p>

        <CreativeCardGrid creatives={creatives} />

        <p className="mt-3 font-body text-xs text-ink/40">
          Audiencia detectada por el nombre del anuncio: contiene &quot;RTG&quot; → Retargeting, contiene
          &quot;PRO&quot; → Prospecting.
        </p>
      </main>
    </div>
  );
}
