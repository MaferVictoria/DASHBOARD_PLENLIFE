// `errors` is an object like { meta: 'message'|null, google: ..., shopify: ... }.
// Only non-null entries render — each page shell decides which keys it cares about.
const LABELS = { meta: 'Meta Ads', google: 'Google Ads', shopify: 'Shopify' };

export default function ErrorBanner({ errors }) {
  const entries = Object.entries(errors).filter(([, msg]) => msg);
  if (entries.length === 0) return null;
  return (
    <div className="mb-6 space-y-1 border border-fall/30 bg-fall/5 px-4 py-3">
      {entries.map(([key, msg]) => (
        <p key={key} className="font-body text-xs text-fall">
          <span className="font-semibold">{LABELS[key] || key}:</span> {msg}
        </p>
      ))}
    </div>
  );
}
