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
import { formatCurrency, formatNumber } from '@/lib/format';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  const failed = point?.failed;
  return (
    <div className="rounded border border-line bg-panel px-3 py-2 shadow-md">
      <p className="font-body text-[10px] uppercase tracking-wide text-ink/50">{label}</p>
      {failed ? (
        <p className="font-body text-sm font-semibold text-fall">No se pudo cargar</p>
      ) : (
        <>
          <p className="font-body text-xs text-ink/70">
            Clientes nuevos: <span className="font-semibold text-ink">{formatNumber(point?.count)}</span>
          </p>
          <p className="font-body text-xs text-ink/70">
            Valor de sus pedidos: <span className="font-semibold text-ink">{formatCurrency(point?.value)}</span>
          </p>
        </>
      )}
    </div>
  );
}

// Bar = count of new customers that month, line = net-sales value of their
// orders — same new-customer criterion as CustomerBreakdown (numberOfOrders
// === 1, with unusable customer data excluded rather than guessed).
export default function NewCustomersMonthlyChart({ data }) {
  const hasGaps = data.some((d) => d.count === null || d.count === undefined);
  const chartData = data.map((d) => ({
    ...d,
    count: d.count ?? 0,
    value: d.value ?? 0,
    failed: d.count === null,
  }));

  return (
    <div className="border border-line bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-body text-[10px] uppercase tracking-[0.14em] text-ink/60">
          Clientes nuevos y valor de sus pedidos — por mes
        </p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-wide text-ink/50">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: '#086eb6' }} />
            Clientes nuevos
          </span>
          <span className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-wide text-ink/50">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#009dde' }} />
            Valor de sus pedidos
          </span>
          {hasGaps && <span className="font-body text-[10px] text-fall">* algunos meses no cargaron</span>}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#D9E6EF" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={{ stroke: '#D9E6EF' }}
            tick={{ fontSize: 11, fill: '#0B2A4599', fontFamily: 'var(--font-poppins)' }}
          />
          <YAxis yAxisId="count" tickLine={false} axisLine={false} width={0} tick={false} />
          <YAxis yAxisId="value" orientation="right" tickLine={false} axisLine={false} width={0} tick={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#0B2A450A' }} />
          <Bar yAxisId="count" dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={28}>
            {chartData.map((entry) => (
              <Cell key={entry.month} fill={entry.failed ? '#D9E6EF' : '#086eb6'} />
            ))}
          </Bar>
          <Line
            yAxisId="value"
            dataKey="value"
            type="monotone"
            stroke="#009dde"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#009dde', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
