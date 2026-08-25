import { formatNumber } from '@/lib/format';

// 5-step funnel: Sesión → Vio un Producto → Agregó al Carrito → Inició
// Checkout → Compró. Each row shows BOTH "% del total" (panorama completo)
// AND "% vs. paso anterior" (dónde se cae la gente específicamente).
//
// The value label sits in its own light "chip" overlaid at the left edge —
// NOT plain text inside the colored fill — so it stays legible even on a
// very narrow bar (e.g. a low-volume "Agregó al Carrito" step) instead of
// getting crushed illegibly inside a thin sliver of color.
export default function CustomerJourneyFunnel({ steps }) {
  const maxValue = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className="border border-line bg-panel p-4">
      <div className="space-y-4">
        {steps.map((step) => {
          const widthPct = Math.max((step.value / maxValue) * 100, 3);
          return (
            <div key={step.key}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="font-body text-xs uppercase tracking-wide text-ink/60">{step.label}</span>
                <span className="font-body text-xs text-ink/50">
                  {step.pctOfTotal.toFixed(1)}% del total
                  {step.pctOfPrevious !== null && (
                    <span className="ml-2 font-semibold text-brand">
                      {step.pctOfPrevious.toFixed(1)}% vs. paso anterior
                    </span>
                  )}
                </span>
              </div>
              <div className="relative h-8 w-full overflow-hidden rounded-sm bg-line/50">
                <div className="h-full bg-brand transition-[width]" style={{ width: `${widthPct}%` }} />
                <span className="absolute inset-y-0 left-0 flex items-center rounded-sm bg-paper/95 px-2.5 font-body text-sm font-semibold text-ink shadow-sm">
                  {formatNumber(step.value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
