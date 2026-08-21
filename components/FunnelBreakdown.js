import { formatNumber, formatPercent } from '@/lib/format';

// Custom CSS funnel (recharts has no first-class funnel chart) styled as
// descending ledger bars so it matches the rest of the report.
//
// Generic over the number of steps — used both for Meta's 4-step pixel
// funnel and Shopify's 2-step real checkout funnel (checkouts started →
// purchases). Pass `steps` as [{ key, label, value }], already in order.
export default function FunnelBreakdown({ steps }) {
  const max = steps[0]?.value || 1;

  return (
    <div className="border border-line bg-panel p-4">
      <div className="space-y-3">
        {steps.map((step, i) => {
          const widthPct = Math.max(6, (step.value / max) * 100);
          const prevValue = i > 0 ? steps[i - 1].value : null;
          const dropoff = prevValue ? step.value / prevValue : 1;
          return (
            <div key={step.key}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="font-body text-[11px] uppercase tracking-wide text-ink/60">
                  {step.label}
                </span>
                <span className="font-body text-sm tabular-nums text-ink">
                  {formatNumber(step.value)}
                  {i > 0 && (
                    <span className="ml-2 text-xs text-ink/40">{formatPercent(dropoff)} vs. anterior</span>
                  )}
                </span>
              </div>
              <div className="h-3 w-full bg-line">
                <div
                  className="h-3"
                  style={{ width: `${widthPct}%`, backgroundColor: i === steps.length - 1 ? '#009dde' : '#086eb6' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
