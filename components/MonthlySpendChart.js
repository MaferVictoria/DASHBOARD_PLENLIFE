'use client';

import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCurrency } from '@/lib/format';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const failed = payload[0].payload?.failed;
  return (
    <div className="rounded border border-line bg-panel px-3 py-2 shadow-md">
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink/50">{label}</p>
      {failed ? (
        <p className="font-mono text-sm font-semibold text-fall">No se pudo cargar</p>
      ) : (
        <p className="font-mono text-sm font-semibold text-ink">{formatCurrency(payload[0].value)}</p>
      )}
    </div>
  );
}

export default function MonthlySpendChart({ data, barColor = '#173C32', label }) {
  const hasGaps = data.some((d) => d.value === null || d.value === undefined);
  const chartData = data.map((d) => ({ ...d, value: d.value ?? 0, failed: d.value === null }));

  return (
    <div className="bg-panel p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/60">{label}</p>
        {hasGaps && (
          <p className="font-mono text-[10px] text-fall">* algunos meses no cargaron</p>
        )}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#E2DED2" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={{ stroke: '#E2DED2' }}
            tick={{ fontSize: 11, fill: '#16241E99', fontFamily: 'var(--font-mono)' }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={0}
            tick={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#16241E0A' }} />
          <Bar dataKey="value" radius={[2, 2, 0, 0]} maxBarSize={36}>
            {chartData.map((entry) => (
              <Cell key={entry.month} fill={entry.failed ? '#E2DED2' : barColor} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
