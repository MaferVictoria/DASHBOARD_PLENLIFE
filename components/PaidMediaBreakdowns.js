'use client';

import { useEffect, useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import SectionHeader from './SectionHeader';
import ErrorBanner from './ErrorBanner';
import { fetchJSON } from '@/lib/fetchJSON';
import { formatCurrency, formatNumber, formatRatio } from '@/lib/format';

const DONUT_COLORS = ['#086eb6', '#8B5CF6', '#009dde', '#E8A33D', '#1F7A5C', '#94A3B8'];

// The 4 metrics the person can toggle between. `visits` means different
// underlying data per platform (Meta: real landing_page_view pixel events;
// Google: ad clicks, the closest available proxy — see connector comments)
// but is presented uniformly here since both represent "top of funnel
// traffic this spend drove."
const METRIC_OPTIONS = [
  { key: 'spend', label: 'Inversión', format: formatCurrency },
  { key: 'visits', label: 'Visitas a la landing', format: formatNumber },
  { key: 'purchases', label: 'Compras', format: formatNumber },
  { key: 'roas', label: 'ROAS', format: formatRatio },
];

// Top 5 by the selected metric, everything else collapsed into "Otros".
// ROAS needs special handling: averaging individual ROAS values for the
// "Otros" bucket would be mathematically wrong (a ratio of ratios) — it's
// recomputed as (sum of revenue for the rest) / (sum of spend for the rest),
// a proper weighted average, using the `revenue` field carried alongside
// each row specifically for this purpose.
function buildTopFiveWithOthers(data, metricKey) {
  const sorted = [...(data || [])].sort((a, b) => b[metricKey] - a[metricKey]);
  const top5 = sorted.slice(0, 5);
  const rest = sorted.slice(5);

  const slices = top5.map((d) => ({ label: d.label, value: d[metricKey] }));

  if (rest.length > 0) {
    let othersValue;
    if (metricKey === 'roas') {
      const restSpend = rest.reduce((s, d) => s + d.spend, 0);
      const restRevenue = rest.reduce((s, d) => s + d.revenue, 0);
      othersValue = restSpend > 0 ? restRevenue / restSpend : 0;
    } else {
      othersValue = rest.reduce((s, d) => s + d[metricKey], 0);
    }
    slices.push({ label: 'Otros', value: othersValue });
  }

  return slices;
}

// Meta brings age+gender back COMBINED in one response (rows like
// {ageRange, gender, spend, ...}) — these two helpers re-aggregate that same
// response into a "por edad" view and a "por género" view, so Meta gets the
// same 2 separate donuts Google has, without needing 2 API calls.
function aggregateBy(rows, keyField) {
  const totals = {};
  rows.forEach((row) => {
    const key = row[keyField];
    if (!totals[key]) totals[key] = { label: key, spend: 0, visits: 0, purchases: 0, revenue: 0 };
    totals[key].spend += row.spend;
    totals[key].visits += row.visits;
    totals[key].purchases += row.purchases;
    totals[key].revenue += row.revenue;
  });
  return Object.values(totals).map((t) => ({ ...t, roas: t.spend > 0 ? t.revenue / t.spend : 0 }));
}

function BreakdownDonut({ data, title, note, error }) {
  const [metric, setMetric] = useState('spend');
  const activeOption = METRIC_OPTIONS.find((m) => m.key === metric);
  const chartData = useMemo(() => buildTopFiveWithOthers(data, metric), [data, metric]);
  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="border border-line bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-body text-[10px] uppercase tracking-[0.14em] text-ink/60">{title}</p>
          {note && <p className="mt-0.5 font-body text-[10px] text-ink/40">{note}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {METRIC_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setMetric(opt.key)}
              className={[
                'rounded-full border px-2.5 py-1 font-body text-[10px] uppercase tracking-wide transition-colors',
                metric === opt.key
                  ? 'border-brand bg-brand text-white'
                  : 'border-line bg-panel text-ink/60 hover:border-brand/50',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="py-6 text-center font-body text-sm text-fall">No se pudo cargar: {error}</p>
      ) : !data || data.length === 0 ? (
        <p className="py-6 text-center font-body text-sm text-ink/50">Sin datos para este periodo.</p>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="w-full max-w-[220px] shrink-0">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="label" innerRadius={52} outerRadius={82} paddingAngle={2}>
                  {chartData.map((entry, i) => (
                    <Cell key={entry.label} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => activeOption.format(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full flex-1 space-y-1.5">
            {chartData.map((d, i) => (
              <li key={d.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-ink/80">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                  />
                  {d.label}
                </span>
                <span className="font-body tabular-nums text-ink/70">
                  {activeOption.format(d.value)}
                  {metric !== 'roas' && total > 0 && (
                    <span className="ml-1.5 text-ink/40">({((d.value / total) * 100).toFixed(1)}%)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const EMPTY_META = { geo: [], demographics: [] };
const EMPTY_GOOGLE = { byRegion: [], byCity: [], byAge: [], byGender: [] };

// Self-contained: fetches its own data from the 2 breakdown routes and
// renders everything — integrated into AdquisicionShell.js via a single
// <PaidMediaBreakdowns range={range} /> line.
export default function PaidMediaBreakdowns({ range }) {
  const [meta, setMeta] = useState(EMPTY_META);
  const [google, setGoogle] = useState(EMPTY_GOOGLE);
  const [errors, setErrors] = useState({ meta: null, google: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = `start=${range.start}&end=${range.end}`;

    Promise.all([fetchJSON(`/api/meta/breakdowns?${qs}`), fetchJSON(`/api/google/breakdowns?${qs}`)])
      .then(([metaRes, googleRes]) => {
        if (cancelled) return;
        const nextErrors = { meta: null, google: null };

        if (metaRes.error) {
          nextErrors.meta = metaRes.error;
          setMeta(EMPTY_META);
        } else {
          setMeta({ geo: metaRes.geo, demographics: metaRes.demographics });
        }

        if (googleRes.error) {
          nextErrors.google = googleRes.error;
          setGoogle(EMPTY_GOOGLE);
        } else {
          setGoogle({
            byRegion: googleRes.byRegion,
            byCity: googleRes.byCity,
            byAge: googleRes.byAge,
            byGender: googleRes.byGender,
          });
        }

        setErrors(nextErrors);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  const metaByAge = useMemo(() => aggregateBy(meta.demographics, 'ageRange'), [meta.demographics]);
  const metaByGender = useMemo(() => aggregateBy(meta.demographics, 'gender'), [meta.demographics]);

  return (
    <div className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
      <ErrorBanner errors={errors} />

      <SectionHeader
        eyebrow="Meta Ads"
        title="Gasto por estado"
        note="Meta no expone desglose por ciudad de forma confiable — agrega a nivel estado"
      />
      <BreakdownDonut data={meta.geo} title="Top 5 estados + Otros" error={errors.meta} />

      <SectionHeader eyebrow="Meta Ads" title="Gasto por edad" />
      <BreakdownDonut data={metaByAge} title="Top 5 edades + Otros" error={errors.meta} />

      <SectionHeader eyebrow="Meta Ads" title="Gasto por género" />
      <BreakdownDonut data={metaByGender} title="Por género" error={errors.meta} />

      <SectionHeader eyebrow="Google Ads" title="Gasto por estado" />
      <BreakdownDonut data={google.byRegion} title="Top 5 estados + Otros" error={errors.google} />

      <SectionHeader eyebrow="Google Ads" title="Gasto por ciudad" />
      <BreakdownDonut data={google.byCity} title="Top 5 ciudades + Otros" error={errors.google} />

      <SectionHeader
        eyebrow="Google Ads"
        title="Gasto por edad"
        note="Google no permite combinar edad y género en una sola consulta"
      />
      <BreakdownDonut data={google.byAge} title="Top 5 edades + Otros" error={errors.google} />

      <SectionHeader eyebrow="Google Ads" title="Gasto por género" />
      <BreakdownDonut data={google.byGender} title="Por género" error={errors.google} />
    </div>
  );
}
