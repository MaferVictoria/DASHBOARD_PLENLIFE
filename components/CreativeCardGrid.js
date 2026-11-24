'use client';

import { useState } from 'react';
import { formatCurrency, formatNumber, formatRatio } from '@/lib/format';

function formatCtr(value) {
  return `${Number(value).toFixed(2)}%`;
}

function formatFrequency(value) {
  return Number(value).toFixed(2);
}

// Order = reading order in the 2-column grid inside each card.
const METRICS = [
  { key: 'reach', label: 'Alcance', format: formatNumber },
  { key: 'uniqueCtr', label: 'CTR único', format: formatCtr },
  { key: 'landingPageViews', label: 'Visitas a la página', format: formatNumber },
  { key: 'addToCart', label: 'Añadidos al carrito', format: formatNumber },
  { key: 'addToCartValue', label: 'Valor carrito', format: formatCurrency },
  { key: 'initiateCheckout', label: 'Inicios de pago', format: formatNumber },
  { key: 'purchases', label: 'Compras', format: formatNumber },
  { key: 'purchaseValue', label: 'Valor de compras', format: formatCurrency },
  { key: 'spend', label: 'Inversión', format: formatCurrency },
  { key: 'roas', label: 'ROAS', format: formatRatio, highlight: true },
  { key: 'costPerVisit', label: 'Costo por visita', format: formatCurrency },
  { key: 'cpa', label: 'Costo por compra', format: formatCurrency },
  { key: 'impressions', label: 'Impresiones', format: formatNumber },
  { key: 'frequency', label: 'Frecuencia', format: formatFrequency },
];

function display(value, format) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return format(value);
}

// Square image box, image NOT cropped (object-contain): portrait/landscape
// creatives get side/top bars instead of being cut off. Tries the original
// image first, then the 600px thumbnail if the original fails to load
// (expired/blocked URL), then falls back to a placeholder.
function CreativeImage({ imageUrl, thumbnailUrl, alt }) {
  const [src, setSrc] = useState(imageUrl || thumbnailUrl || null);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center font-body text-xs text-ink/40">Sin imagen</div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-full w-full object-contain"
      onError={() => {
        if (thumbnailUrl && src !== thumbnailUrl) setSrc(thumbnailUrl);
        else setFailed(true);
      }}
    />
  );
}

export default function CreativeCardGrid({ creatives }) {
  if (!creatives || creatives.length === 0) {
    return (
      <div className="border border-line bg-panel p-6 text-center">
        <p className="font-body text-sm text-ink/50">
          No hay anuncios con gasto en este periodo para esta selección.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {creatives.map((c, index) => (
        <article key={`${c.adId}:${c.imageUrl || c.thumbnailUrl || ''}`} className="flex flex-col overflow-hidden border border-line bg-panel">
          <div className="relative aspect-square bg-paper">
            <CreativeImage imageUrl={c.imageUrl} thumbnailUrl={c.thumbnailUrl} alt={c.adName} />
            <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-ink font-body text-sm font-semibold text-white">
              {index + 1}
            </span>
          </div>

          <div className="flex flex-1 flex-col p-4">
            <h3 className="line-clamp-2 font-display text-sm font-semibold text-ink" title={c.adName}>
              {c.adName}
            </h3>
            <p className="mt-1 font-body text-xs text-ink/65">
              {c.objective ? `${c.objective} · ` : ''}
              {c.audience}
            </p>
            {c.campaignName && (
              <p className="mt-0.5 truncate font-body text-xs text-ink/45" title={c.campaignName}>
                {c.campaignName}
              </p>
            )}

            <div className="my-3 border-t border-line" />

            <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
              {METRICS.map((m) => (
                <div key={m.key}>
                  <dt className="font-body text-[10px] uppercase tracking-wide text-ink/50">{m.label}</dt>
                  <dd
                    className={`font-body text-base font-semibold tabular-nums ${
                      m.highlight ? 'text-brand' : 'text-ink'
                    }`}
                  >
                    {display(c[m.key], m.format)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </article>
      ))}
    </div>
  );
}
