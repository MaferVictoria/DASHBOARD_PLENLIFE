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
  (`/insights`) usando `META_ACCESS_TOKEN` y `META_AD_ACCOUNT_ID`.
- **Shopify → conectado de verdad.** `lib/connectors/shopify.js` llama a la Admin API
  (GraphQL) usando `SHOPIFY_STORE_DOMAIN` y `SHOPIFY_ADMIN_API_TOKEN`. Lee los pedidos
  reales de la tienda para ventas, pedidos, clientes, top ciudades y top productos.
  El **funnel** (visitas → carrito → pago → compra) sigue en mock — la API de Órdenes
  de Shopify no tiene esos datos de sesión; se necesita la API de Analytics de Shopify
  o GA4 (ver el comentario al inicio de `lib/connectors/shopify.js`).
- **Google Ads → conectado de verdad.** `lib/connectors/googleAds.js` usa OAuth
  (refresh token) + GAQL (Google Ads Query Language) contra la API real, filtrado
  siempre a `campaign.advertising_channel_type = 'PERFORMANCE_MAX'`. Si tu developer
  token quedó en **Explorer Access** (el nivel automático, sin solicitud), el límite
  es 2,880 operaciones/día — de sobra para este dashboard. Si algún día ves errores
  de `RESOURCE_EXHAUSTED`, es la señal de que hay que solicitar Basic Access.

Si por alguna razón las variables de entorno no están presentes (por ejemplo corriendo
`npm run dev` en tu laptop sin `.env.local`), cada conector cae automáticamente a datos
de ejemplo para que puedas seguir trabajando — pero en Vercel, con las variables ya
puestas, jala datos reales.

### ⚠️ Cosas a vigilar con el conector real de Shopify

1. **Aproximaciones, no exactitud perfecta.** "Nuevos vs. recurrentes" usa el conteo
   de pedidos de por vida del cliente (`numberOfOrders`) al momento de la consulta —
   es la aproximación estándar en este tipo de integración, pero no es idéntica al
   reporte nativo de Shopify (Analytics → "Primera compra vs. recurrente"), que sí
   sabe con certeza cuál fue el primer pedido de cada cliente. "Ventas totales/netas"
   se aproximan de `currentTotalPriceSet`/`currentSubtotalPriceSet` — deberían
   coincidir muy de cerca con los reportes de Shopify, pero no están garantizados a
   coincidir al peso. Te recomiendo comparar contra el Shopify Analytics nativo la
   primera semana para calibrar confianza.
2. **"Todo el histórico" puede tronar en el plan Hobby de Vercel.** Las funciones
   serverless en Hobby tienen un límite de ~10 segundos. Si Plenlife tiene muchos
   pedidos acumulados, agregar años de historial en una sola consulta puede
   exceder ese límite (verás un timeout, o el error explícito de "demasiadas
   órdenes" que puse como límite de seguridad en el código). Si eso pasa:
   acota el rango, sube a Vercel Pro, o (la solución correcta a mayor escala)
   cambia esto a un job que precalcula y guarda los resultados en vez de
   calcularlos en cada carga de página.
3. **No lo he podido probar contra la tienda real** (mi entorno no tiene acceso
   a la red de Shopify) — el código está escrito correctamente según la
   documentación de la GraphQL Admin API, pero revisa los logs de la función en
   Vercel (Deployments → función `/api/shopify`) las primeras veces que lo uses
   para confirmar que todo jala bien.

## Filtro de fecha y comparación de periodos

El selector de fecha ahora es un dropdown (como el de Shopify) con: Hoy, Ayer,
Últimos 7/14/30 días, Mes pasado, Mes actual, Todo el histórico, y Personalizado.

**Todas las tarjetas de KPI muestran el cambio vs. el periodo anterior** (absoluto
y %). La comparación es contra un periodo de la misma duración inmediatamente
anterior al seleccionado (el mismo criterio que usan GA4 y la mayoría de
plataformas de ads) — por ejemplo, "Últimos 7 días" se compara contra los 7 días
antes de esos. Para "Mes actual" (que normalmente está incompleto), se compara
contra el mismo número de días de tapa del mes pasado, no contra el mes pasado
completo, para que sea una comparación justa.

**"Todo el histórico" no muestra comparación** — no existe un "periodo anterior"
al histórico completo, así que las tarjetas muestran "sin periodo previo" en vez
de un porcentaje inventado.

Para CPA y CAC (donde bajar es bueno), el color se invierte: un aumento se ve en
rojo y una baja en verde — al revés que en gasto/ventas/pedidos, donde subir es
lo que normalmente se busca.

## Desplegar en Vercel

1. Sube este contenido a tu repo (`git init`, `git add .`, `git commit`, `git push`).
2. En vercel.com, "Add New Project" → importa el repo → Vercel detecta Next.js
   automáticamente, no hace falta configurar nada.
3. Agrega las variables de entorno antes del primer deploy con datos reales.

## Próximos pasos sugeridos

- Vigilar los logs de Vercel las primeras veces que uses "Todo el histórico" en Shopify.
- Decidir si el top de ciudades/productos debe respetar el rango de fecha
  seleccionado (hoy siempre muestra los últimos 3 meses, sin importar el filtro).
- Autenticación/acceso al dashboard si se va a "subir a la web" públicamente.
