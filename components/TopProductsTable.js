import { formatCurrency } from '@/lib/format';

export default function TopProductsTable({ data }) {
  return (
    <div className="grid gap-px bg-line sm:grid-cols-3">
      {data.map(({ month, products }) => (
        <div key={month} className="bg-panel p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/60">{month}</p>
          <ol className="space-y-1.5">
            {products.map((p, i) => (
              <li key={p.product} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 truncate text-ink/80">
                  <span className="font-mono text-xs text-ink/40">{String(i + 1).padStart(2, '0')}</span>
                  <span className="truncate">{p.product}</span>
                </span>
                <span className="shrink-0 font-mono tabular-nums text-ink/80">
                  {formatCurrency(p.sales)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
