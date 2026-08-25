'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatNumber } from '@/lib/format';

const COLORS = ['#086eb6', '#8B5CF6', '#009dde', '#E8A33D', '#94A3B8'];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded border border-line bg-panel px-3 py-2 shadow-md">
      <p className="font-body text-xs font-semibold text-ink">{d.name}</p>
      <p className="font-body text-xs text-ink/70">
        {formatNumber(d.sessions)} sesiones ({d.pct.toFixed(1)}%)
      </p>
    </div>
  );
}

// data: [{name, sessions, users, pct}] — 5 fixed buckets (Direct/Social/
// Search/Email/Otros), always in that order so the legend/colors stay
// consistent across reloads.
export default function ChannelDonutChart({ data }) {
  return (
    <div className="border border-line bg-panel p-4">
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="w-full max-w-[220px] shrink-0">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data} dataKey="sessions" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2}>
                {data.map((entry, i) => (
                  <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="w-full flex-1 space-y-1.5">
          {data.map((d, i) => (
            <li key={d.name} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-ink/80">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {d.name}
              </span>
              <span className="font-body tabular-nums text-ink/70">
                {formatNumber(d.sessions)} <span className="text-ink/40">({d.pct.toFixed(1)}%)</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
