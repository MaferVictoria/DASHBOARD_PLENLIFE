// KPI card styled like a nutrition-facts ledger: thick rule, small-caps
// label, one bold number, thin rule, optional sublabel. It's a deliberate
// nod to the client's own product category rather than a generic stat tile.

export default function KpiCard({ label, value, sublabel }) {
  return (
    <div className="flex flex-col bg-panel px-4 py-3">
      <div className="rule-thick border-t-2 border-ink pt-1.5">
        <p className="font-body text-[10px] uppercase tracking-[0.14em] text-ink/60">{label}</p>
      </div>
      <p className="mt-2 font-body text-2xl font-semibold tabular-nums text-ink sm:text-[28px]">
        {value}
      </p>
      <div className="rule-thin mt-2 border-t pt-1">
        <p className="font-body text-[10px] text-ink/45">{sublabel || '\u00A0'}</p>
      </div>
    </div>
  );
}
