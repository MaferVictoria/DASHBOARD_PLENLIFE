# Plenlife — Panel de Marketing

Dashboard interno (Next.js) que junta Meta Ads, Google Ads (PMax) y Shopify en
un solo lugar, pensado para desplegarse en Vercel desde este mismo repo.

Ahora mismo corre con **datos de ejemplo (mock)** para que puedas navegar la
estructura completa de inmediato. Los conectores reales están dejados listos
en `lib/connectors/` — sustituir el mock ahí es el único paso pendiente para
que muestre datos reales.

## Cómo correrlo localmente

```bash
npm install
npm run dev
```

Abre http://localhost:3000 — vas a ver las 4 pestañas ya navegables con datos
de ejemplo.

## Estructura de carpetas

```
app/
  page.js              → Pestaña "Resumen general" (Meta + Google + Shopify)
  meta/page.js          → Pestaña "Meta"
  google/page.js        → Pestaña "Google"
  shopify/page.js        → Pestaña "Shopify"
  api/meta/route.js      → Endpoint que sirve métricas de Meta
  api/google/route.js    → Endpoint que sirve métricas de Google Ads
  api/shopify/route.js   → Endpoint que sirve métricas de Shopify
  layout.js / globals.css → Layout raíz, fuentes y estilos base

components/
  DashboardShell.js      → Arma cada pestaña: fetch de datos + qué secciones mostrar
  TabNav.js               → Navegación entre las 4 pestañas
  DateRangeSelector.js    → 7 / 14 / 30 días + rango personalizado
  KpiCard.js / KpiGrid.js → Tarjetas de KPIs (cambian según la pestaña)
  MonthlySpendChart.js    → Desglose mensual (Ene → mes actual)
  PlatformComparisonTable.js → Meta / Google / Shopify lado a lado (no atribución)
  TopCitiesTable.js       → Top ciudades por mes
  TopProductsTable.js     → Top productos por mes
  FunnelBreakdown.js      → Visitas → carrito → pago → compra

lib/
  connectors/meta.js       → TODO: reemplazar mock por la llamada real a Meta Marketing API
  connectors/googleAds.js  → TODO: reemplazar mock por la llamada real a Google Ads API (PMax)
  connectors/shopify.js    → TODO: reemplazar mock por la llamada real a Shopify Admin API
  mockData.js              → Generador de datos de ejemplo (borrar cuando ya no se use)
  metrics.js               → Cálculo de MER, ROAS blended, CAC blended
  dateRanges.js             → Lógica de presets de fecha
  format.js                 → Formato de moneda/números en es-MX
```

## Qué se ve en cada pestaña

| Sección | Resumen general | Meta | Google | Shopify |
|---|---|---|---|---|
| KPIs | ✅ (blended) | ✅ | ✅ | ✅ |
| Desglose mensual | ✅ (Meta + Google) | ✅ | ✅ | ✅ (ventas netas) |
| Tabla Plataformas vs. Shopify | ✅ | — | — | — |
| Top ciudades / productos por mes | ✅ | — | — | ✅ |
| Funnel (visitas → compra) | ✅ | — | — | ✅ |

**Nota de una decisión que tomé:** la tabla comparativa, el top de
ciudades/productos y el funnel viven en "Resumen general" y "Shopify" porque
son datos que solo existen del lado de Shopify (o son, por definición, un
cruce entre plataformas). No tendría sentido repetirlos en las pestañas de
Meta o Google, que no tienen esa información. Si prefieres verlos en las 4
pestañas de todos modos, es un cambio pequeño en `DashboardShell.js`
(las banderas `showComparison` / `showCitiesProducts` / `showFunnel`).

## Marca (colores y tipografía)

El dashboard usa la paleta oficial de Plenlife, definida como tokens en `tailwind.config.js`:

| Token | Hex | Uso |
|---|---|---|
| `brand` (DEFAULT) | `#086eb6` | Azul principal — headers activos, barras de Meta, funnel |
| `brand-bright` | `#009dde` | Azul secundario — acentos interactivos, barras de Google, último paso del funnel |
| `panel` | `#ffffff` | Blanco de marca — todas las tarjetas y superficies |
| `paper` | `#eef5fa` | Fondo de página (un tinte muy claro del azul, para que las tarjetas blancas resalten) |
| `ink` | `#0b2a45` | Texto — un azul marino oscuro derivado de la marca (negro puro chocaría con la paleta) |
| `line` | `#d9e6ef` | Líneas divisorias |

**Tipografía:** todo el dashboard usa **Poppins** (vía `next/font/google`, pesos 400–700) — títulos, cuerpo, tablas y números.

**Sobre "Biro Script":** no está disponible en Google Fonts — es una fuente de terceros (IngoFonts) cuya versión gratuita es solo para uso personal; la versión con licencia comercial ("Biro Script Plus") es de paga. Como además es manuscrita, no es ideal para números/tablas de un dashboard. Por ahora el header solo muestra el texto "Plenlife" en azul de marca. Si me pasas el archivo de la fuente con licencia comercial (`.woff2`), puedo agregarla como acento puntual (por ejemplo, solo en el wordmark del header) vía `next/font/local`. También podríamos simplemente usar el logo real de Plenlife (imagen) en el header en vez de tipografía — mándamelo en PNG/SVG con fondo transparente y lo integro.

## Estado de las conexiones

- **Meta Ads → conectado de verdad.** `lib/connectors/meta.js` llama a la Marketing API
  (`/insights`) usando `META_ACCESS_TOKEN` y `META_AD_ACCOUNT_ID` (ya están en tus
  variables de entorno de Vercel). Si por alguna razón esas variables no están
  presentes (por ejemplo corriendo `npm run dev` en tu laptop sin `.env.local`),
  cae automáticamente a datos de ejemplo para que puedas seguir trabajando —
  pero en Vercel, con las variables ya puestas, va a jalar datos reales.
- **Google Ads y Shopify → siguen en mock**, listos para el mismo tratamiento
  cuando tengas las credenciales.

### Qué pasa si Meta falla (token vencido, cuenta equivocada, rate limit, etc.)

A propósito, **no** se esconde el error mostrando números falsos. Si la llamada
a Meta falla, el endpoint `/api/meta` regresa un error explícito y vas a ver un
aviso rojo arriba del dashboard con el mensaje real de la API (por ejemplo,
"Meta Insights API: Error validating access token"). Esto es intencional: en un
dashboard que informa decisiones de negocio, es peor ver un ROAS que se ve bien
pero es inventado, que ver un aviso de "esto no cargó".

Si quieres confirmar que la conexión real está jalando bien una vez desplegado,
revisa los logs de la función en Vercel (Deployments → función `/api/meta`) —
ahí vas a ver cualquier `console.error` si algo falla.

## Conectar datos reales

Cada archivo en `lib/connectors/` tiene un comentario `TODO` con el endpoint
exacto, los campos a mapear, y qué credenciales necesita. En resumen:

1. Copia `.env.example` a `.env.local` y llena las credenciales de Meta,
   Google Ads y Shopify.
2. En Vercel, agrega esas mismas variables en **Project Settings → Environment
   Variables**.
3. En cada archivo de `lib/connectors/`, reemplaza la función mock por la
   llamada real (las funciones ya tienen la firma correcta — `getMetaTotals(start, end)`,
   etc. — así que el resto de la app no necesita cambios).
4. Borra `lib/mockData.js` cuando ya nada lo use.

## Desplegar en Vercel

1. Sube este contenido a tu repo (`git init`, `git add .`, `git commit`, `git push`).
2. En vercel.com, "Add New Project" → importa el repo → Vercel detecta Next.js
   automáticamente, no hace falta configurar nada.
3. Agrega las variables de entorno antes del primer deploy con datos reales.

## Próximos pasos sugeridos

- Conectar las 3 APIs reales (ver sección anterior).
- Decidir si el rango de fechas "personalizado" también debe filtrar el top
  de ciudades/productos (hoy siempre muestra los últimos 3 meses) o solo los
  KPIs — depende de qué tan seguido se va a usar un rango que no sea mensual.
- Autenticación/acceso al dashboard si se va a "subir a la web" públicamente.
