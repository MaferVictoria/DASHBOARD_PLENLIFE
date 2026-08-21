'use client';

import { useEffect, useState, useMemo } from 'react';
import { useDateRange } from './DateRangeProvider';
import DateRangeSelector from './DateRangeSelector';
import CreativeRankingTable from './CreativeRankingTable';
import SectionHeader from './SectionHeader';
import ErrorBanner from './ErrorBanner';
import { fetchJSON } from '@/lib/fetchJSON';

// Derives audience from ad naming convention: "RTG" = Retargeting,
// "PRO" = Prospecting. Case-insensitive substring match against the ad name
// — if your naming convention changes, this is the only place to update.
function classifyAudience(adName) {
  if (!adName) return 'Sin clasificar';
  const upper = adName.toUpperCase();
  if (upper.includes('RTG')) return 'Retargeting';
  if (upper.includes('PRO')) return 'Prospecting';
  return 'Sin clasificar';
}

const AUDIENCE_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'Prospecting', label: 'Prospecting' },
  { id: 'Retargeting', label: 'Retargeting' },
  { id: 'Sin clasificar', label: 'Sin clasificar' },
];

export default function CreativosShell() {
  const { range } = useDateRange();
  const [loading, setLoading] = useState(true);
  const [creatives, setCreatives] = useState([]);
  const [errors, setErrors] = useState({ meta: null });
  const [audienceFilter, setAudienceFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchJSON(`/api/meta/creatives?start=${range.start}&end=${range.end}`)
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          setErrors({ meta: res.error });
          setCreatives([]);
        } else {
          setErrors({ meta: null });
          setCreatives(res.creatives || []);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  const classified = useMemo(
    () => creatives.map((c) => ({ ...c, audience: classifyAudience(c.adName) })),
    [creatives]
  );

  const filtered =
    audienceFilter === 'all' ? classified : classified.filter((c) => c.audience === audienceFilter);

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

        <SectionHeader
          eyebrow="Ranking"
          title="Top creativos por ROAS"
          note={`${range.start} → ${range.end}`}
        />

        <div className="mb-3 flex flex-wrap gap-2">
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

        <CreativeRankingTable creatives={filtered} />

        <p className="mt-2 font-body text-xs text-ink/40">
          Audiencia detectada por el nombre del anuncio: contiene &quot;RTG&quot; → Retargeting, contiene
          &quot;PRO&quot; → Prospecting.
        </p>
      </main>
    </div>
  );
}
