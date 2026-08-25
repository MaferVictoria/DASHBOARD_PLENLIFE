'use client';

import {
  ComposedChart,
  Bar,
  Line,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { formatCurrency, formatNumber, formatRatio } from '@/lib/format';

const FORMATTERS = { currency: formatCurrency, number: formatNumber, ratio: formatRatio };

function CustomTooltip({ active, payload, label, series }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  const failed = point?.failed;
  return (
    <div className="rounded border border-line bg-panel px-3 py-2 shadow-md">
      <p className="font-body text-[10px] uppercase tracking-wide text-ink/50">{label}</p>
      {failed ? (
        <p className="font-body text-sm font-semibold text-fall">No se pudo cargar</p>
      ) : (
        series.map((s) => {
          const fmt = FORMATTERS[s.format] || formatNumber;
          return (
            <p key={s.dataKey} className="font-body text-xs text-ink/70">
              {s.label}: <span className="font-semibold text-ink">{fmt(point?.[s.dataKey])}</span>
            </p>
          );
        })
      )}
    </div>
  );
}

// General-purpose combo chart: up to 2 bars (sharing ONE currency-style axis
// so their heights stay visually comparable) + up to 2 lines (each on its
// OWN hidden axis, since lines usually represent a different unit — order
// counts, ROAS ratios — that shouldn't be forced onto the bars' scale).
//
// `bars`/`lines`: [{ dataKey, label, color, format: 'currency'|'number'|'ratio' }]
export default function MultiMetricMonthlyChart({ data, label, bars = [], lines = [], failedKey }) {
  const gapKey = failedKey || bars[0]?.dataKey || lines[0]?.dataKey;
  const hasGaps = data.some((d) => d[gapKey] === null || d[gapKey] === undefined);
  const allSeries = [...bars, ...lines];

  const chartData = data.map((d) => {
    const clean = { ...d, failed: d[gapKey] === null || d[gapKey] === undefined };
    allSeries.forEach((s) => {
      clean[s.dataKey] = d[s.dataKey] ?? 0;
    });
    return clean;
  });

  return (
    <div className="border border-line bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-body text-[10px] uppercase tracking-[0.14em] text-ink/60">{label}</p>
        <div className="flex flex-wrap items-center gap-3">
          {bars.map((b) => (
            <span
              key={b.dataKey}
              className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-wide text-ink/50"
            >
              <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: b.color }} />
              {b.label}
            </span>
          ))}
          {lines.map((l) => (
            <span
              key={l.dataKey}
              className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-wide text-ink/50"
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
              {l.label}
            </span>
          ))}
          {hasGaps && <span className="font-body text-[10px] text-fall">* algunos meses no cargaron</span>}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#D9E6EF" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={{ stroke: '#D9E6EF' }}
            tick={{ fontSize: 11, fill: '#0B2A4599', fontFamily: 'var(--font-poppins)' }}
          />
          {bars.length > 0 && <YAxis yAxisId="bars" tickLine={false} axisLine={false} width={0} tick={false} />}
          {lines.map((l) => (
            <YAxis key={l.dataKey} yAxisId={l.dataKey} tickLine={false} axisLine={false} width={0} tick={false} />
          ))}
          <Tooltip content={<CustomTooltip series={allSeries} />} cursor={{ fill: '#0B2A450A' }} />
          {bars.map((b) => (
            <Bar key={b.dataKey} yAxisId="bars" dataKey={b.dataKey} radius={[2, 2, 0, 0]} maxBarSize={24}>
              {chartData.map((entry) => (
                <Cell key={entry.month} fill={entry.failed ? '#D9E6EF' : b.color} />
              ))}
            </Bar>
          ))}
          {lines.map((l) => (
            <Line
              key={l.dataKey}
              yAxisId={l.dataKey}
              dataKey={l.dataKey}
              type="monotone"
              stroke={l.color}
              strokeWidth={3}
              dot={{ r: 3.5, fill: l.color, strokeWidth: 0 }}
              activeDot={{ r: 5.5 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
