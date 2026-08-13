export default function SectionHeader({ eyebrow, title, note }) {
  return (
    <div className="mb-4 mt-10 first:mt-0">
      <div className="flex items-baseline justify-between rule-thick pt-2">
        <div>
          {eyebrow && (
            <p className="font-body text-[11px] uppercase tracking-[0.18em] text-brand/70">
              {eyebrow}
            </p>
          )}
          <h2 className="font-display text-xl font-medium text-ink">{title}</h2>
        </div>
        {note && <p className="hidden max-w-xs text-right text-xs text-ink/50 sm:block">{note}</p>}
      </div>
    </div>
  );
}
