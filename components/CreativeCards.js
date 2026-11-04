'use client';
import { useEffect, useState } from 'react';
import { formatCurrency, formatNumber, formatRatio } from '@/lib/format';
import './CreativeCards.css';

function percentage(value) {
  return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(2)}%`;
}
function decimal(value) {
  return value == null || !Number.isFinite(value) ? '—' : value.toFixed(2);
}
function Metric({ label, value }) {
  return <div className="creative-metric"><dt>{label}</dt><dd>{value}</dd></div>;
}
function CreativeCard({ creative: c, rank }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [c.thumbnailUrl]);
  return (
    <article className="creative-card">
      <div className="creative-media">
        <span className="creative-rank" aria-label={`Posición ${rank}`}>{rank}</span>
        {c.thumbnailUrl && !failed ? (
          // URLs temporales de Meta; se muestran directamente, sin reutilizar imágenes de otro cliente.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.thumbnailUrl} alt={`Miniatura de ${c.adName}`} loading="lazy" onError={() => setFailed(true)} />
        ) : <span className="creative-image-empty">Imagen no disponible</span>}
      </div>
      <div className="creative-body">
        <h3>{c.adName}</h3>
        <p className="creative-context">{c.audience || 'Sin clasificar'}</p>
        <p className="creative-campaign">{c.campaignName || 'Campaña no disponible'}</p>
        <dl className="creative-metrics">
          <Metric label="Alcance" value={formatNumber(c.reach)} />
          <Metric label="CTR único" value={percentage(c.uniqueCtr)} />
          <Metric label="Visitas a la página" value={formatNumber(c.landingPageViews)} />
          <Metric label="Añadidos al carrito" value={formatNumber(c.addToCart)} />
          <Metric label="Valor carrito" value={formatCurrency(c.cartValue)} />
          <Metric label="Inicios de checkout" value={formatNumber(c.initiateCheckout)} />
          <Metric label="Compras" value={formatNumber(c.purchases)} />
          <Metric label="Valor de compra" value={formatCurrency(c.purchaseValue)} />
          <Metric label="Inversión" value={formatCurrency(c.spend)} />
          <Metric label="ROAS" value={formatRatio(c.roas)} />
        </dl>
        <details className="creative-extra"><summary>Más métricas</summary><dl className="creative-metrics">
          <Metric label="Impresiones" value={formatNumber(c.impressions)} />
          <Metric label="Frecuencia" value={decimal(c.frequency)} />
          <Metric label="Costo por visita" value={formatCurrency(c.costPerVisit)} />
          <Metric label="Costo por compra" value={formatCurrency(c.cpa)} />
        </dl></details>
      </div>
    </article>
  );
}
export default function CreativeCards({ creatives, page, pageSize }) {
  if (!creatives.length) return <div className="creative-empty">No se encontraron anuncios con gasto para este periodo y filtros.</div>;
  return <div className="creative-grid">{creatives.map((c, i) => <CreativeCard key={c.adId} creative={c} rank={(page - 1) * pageSize + i + 1} />)}</div>;
          }
