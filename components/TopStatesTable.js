import { formatCurrency } from '@/lib/format';

export default function TopStatesTable({ data }) {
  return (
    <div className="grid gap-px border border-line bg-line sm:grid-cols-2">
      {data.map(({ month, states }) => (
        <div key={month} className="bg-panel p-4">
          <p className="mb-2 font-body text-[10px] uppercase tracking-[0.14em] text-ink/60">{month}</p>
          <ol className="space-y-1.5">
            {states.map((s, i) => (
              <li key={s.state} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-ink/80">
                  <span className="font-body text-xs text-ink/40">{String(i + 1).padStart(2, '0')}</span>
                  {s.state}
                </span>
                <span className="font-body tabular-nums text-ink/80">{formatCurrency(s.sales)}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
