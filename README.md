# Plenlife — Panel de Marketing

Dashboard interno (Next.js) que junta Meta Ads, Google Ads (PMax) y Shopify en
un solo lugar, organizado por **objetivo de negocio** (no por herramienta),
pensado para desplegarse en Vercel desde este mismo repo.

## Cómo correrlo localmente

```bash
npm install
npm run dev
```

Abre http://localhost:3000. Cualquier conector sin credenciales cae
automáticamente a datos de ejemplo, así que puedes navegar todo de inmediato.

## Estructura de navegación (4 pestañas, por objetivo)

| Pestaña | Ruta | Qué contiene |
|---|---|---|
| **Resumen Ejecutivo** | `/` | KPIs blended, gasto total vs. ventas, cruce de plataformas, Adquisición vs. Retención, top estados/productos, funnel de checkout |
| **Adquisición / Paid Media** | `/adquisicion` | Meta y Google consolidados: KPIs, gasto vs. ventas generadas por cada uno, funnel de píxel de Meta |
| **Ventas y Clientes** | `/ventas-clientes` | Datos 100% nativos de Shopify: ventas, nuevos vs. recurrentes, clientes nuevos por mes, carritos abandonados |
| **Biblioteca de Creativos** | `/creativos` | Ranking de los mejores anuncios de Meta por ROAS, con miniatura |

El filtro de fecha (arriba a la derecha en cada pestaña) es **compartido entre
las 4** — se guarda en un Context de React que vive en `app/layout.js` (no se
resetea al cambiar de pestaña, ver `components/DateRangeProvider.js`).

## Estructura de carpetas

```
app/
  page.js                    → Resumen Ejecutivo (/)
  adquisicion/page.js         → Adquisición / Paid Media
  ventas-clientes/page.js     → Ventas y Clientes
  creativos/page.js           → Biblioteca de Creativos
  api/meta/route.js           → Totales + mensual + funnel de Meta
  api/meta/creatives/route.js → Ranking de creativos (nivel anuncio) de Meta
  api/google/route.js         → Totales + mensual de Google Ads
  api/shopify/route.js        → Totales + mensual + top estados/productos + funnel de checkout
  layout.js                   → Sidebar + DateRangeProvider + fuentes

components/
  Sidebar.js                  → Navegación lateral (logo + 4 pestañas)
  DateRangeProvider.js        → Context del filtro de fecha compartido
  ResumenEjecutivoShell.js     → Arma la pestaña de Resumen Ejecutivo
  AdquisicionShell.js          → Arma la pestaña de Adquisición
  VentasClientesShell.js       → Arma la pestaña de Ventas y Clientes
  CreativosShell.js            → Arma la pestaña de Biblioteca de Creativos
  KpiGrid.js / KpiCard.js      → Tarjetas de KPI (con cambio vs. periodo anterior)
  ComboMonthlyChart.js         → Gráfico combinado (barra de gasto + línea de ventas)
  MonthlySpendChart.js         → Gráfico de una sola serie (usado en Shopify)
  NewCustomersMonthlyChart.js  → Clientes nuevos + valor de sus pedidos, por mes
  UserBehaviorPanel.js         → Adquisición vs. Retención
  CustomerBreakdown.js         → Nuevos/recurrentes/ticket promedio (snapshot del periodo)
  CreativeRankingTable.js      → Tabla de ranking de creativos
  TopStatesTable.js            → Top estados por mes
  TopProductsTable.js          → Top productos por mes
  FunnelBreakdown.js           → Funnel genérico (2 o 4 pasos, según quién lo use)
  PlatformComparisonTable.js   → Meta / Google / Shopify lado a lado (no atribución)
  ErrorBanner.js               → Banner rojo de errores, compartido

lib/
  connectors/meta.js          → TODO real: totales, mensual, funnel, ranking de creativos
  connectors/googleAds.js     → TODO real: totales, mensual
  connectors/shopify.js       → TODO real: totales, mensual, top estados/productos, carritos abandonados
  fetchJSON.js                 → Helper de fetch compartido (nunca truena, regresa {error})
  mockData.js                  → Generador de datos de ejemplo
  metrics.js                   → Cálculo de MER, ROAS blended, CAC blended, cambios de periodo
  dateRanges.js                 → Presets de fecha + cálculo de periodo anterior
  format.js                     → Formato de moneda/números en es-MX
```

## Marca (colores y tipografía)

| Token | Hex | Uso |
|---|---|---|
| `sidebar` | `#086eb6` | Fondo de la barra lateral — el único lugar azul de marca |
| `brand` (DEFAULT) | `#086eb6` | Acentos, texto de enlaces activos, ROAS en la tabla de creativos |
| `brand-bright` | `#009dde` | Líneas de gráficos, checkmarks |
| `panel` / `paper` | `#ffffff` | Todo el resto del dashboard es blanco — las tarjetas se distinguen por borde (`line`), no por color de fondo |
| `ink` | `#0b2a45` | Texto |
| `line` | `#d9e6ef` | Bordes y líneas divisorias |

Tipografía: **Poppins** en todo.

## Estado de las conexiones reales

- **Meta Ads** → conectado de verdad (totales, mensual, funnel de píxel, y
  ahora también **ranking de creativos a nivel anuncio** con miniatura vía
  `lib/connectors/meta.js` → `getMetaTopCreatives()`).
- **Google Ads (PMax)** → conectado de verdad (totales, mensual).
- **Shopify** → conectado de verdad (totales, mensual, top estados/productos,
  clientes nuevos por mes, **carritos abandonados** vía `abandonedCheckoutsCount`).

Si un conector no tiene credenciales configuradas, cae a datos de ejemplo
automáticamente — pero en Vercel, con las variables puestas, todo jala real.

## Cambios del 25 agosto 2026 (checklist de 9 puntos)

Implementados a partir de un doc de cambios del cliente. Decisiones de diseño
que tomé y que vale la pena que conozcas:

1. **Colores de líneas vs. barras** — antes las líneas usaban el mismo azul
   que las barras (poco contraste). Ahora las líneas usan colores dedicados:
   **ámbar `#E8A33D`** para "pedidos" y **violeta `#8B5CF6`** para "ROAS
   promedio", consistentes en todos los gráficos del dashboard.
2. **Gráfico de Resumen Ejecutivo** — ahora son 2 barras (Gasto total,
   Ventas netas Shopify) + 1 línea (Pedidos). Nuevo componente genérico
   `MultiMetricMonthlyChart.js` que reemplaza a `ComboMonthlyChart.js`
   (borrado, ya no lo usa nadie).
3. **Tabla Plataformas vs. Shopify** — Shopify ahora son 3 filas (brutas/
   netas/totales) en vez de 1. "Ventas brutas" es nuevo: se calcula desde el
   precio original (antes de descuento) de cada línea de producto — requirió
   agregar `originalTotalSet` a la consulta de Shopify. El % de variación se
   calcula siempre contra **Ventas Netas** de Shopify.
4. **Adquisición vs. Retención** — el lado de Adquisición ahora tiene un
   borde y fondo azul de marca para distinguirlo. "Costo por visita" se
   quitó (seguía sin dato disponible) y en su lugar va "Ticket promedio
   (nuevos)". Los 6 datos ahora muestran % vs. periodo anterior, siempre.
5. **Top estados/productos** — fecha en formato "1 de agosto de 2026", el
   conteo de pedidos/unidades ahora es su propia línea en negrita/color (ya
   no un paréntesis chiquito), y cada estado/producto individual tiene su
   propio % vs. el mismo estado/producto en el periodo anterior — esto
   necesitó una segunda consulta a Shopify (el periodo anterior completo)
   dentro de `getShopifyTopStatesByMonth`/`getShopifyTopProductsByMonth`,
   no solo los datos que ya se estaban pidiendo.
6. **Funnel de compras (Resumen Ejecutivo)** — ⚠️ este es el que requiere
   más contexto. El documento pide un funnel completo de "visitas → compra",
   con una referencia que mezcla Meta + Shopify como fuente. Technically,
   Shopify no puede dar "visitas"/"carrito" (ver limitación ya documentada
   más abajo) — así que, siguiendo la referencia del cliente, el funnel
   ahora es de **4 pasos con fuente mixta, claramente etiquetada**: Visitas
   y Carrito vienen del píxel de Meta (`getMetaFunnel`, ya existía, reusado
   aquí), Checkout y Compras siguen siendo 100% Shopify real. Esto es una
   aproximación honesta — el "Visitas" que ves es tráfico atribuido a Meta,
   no el tráfico total del sitio. Si el cliente esperaba tráfico total real,
   eso sigue necesitando GA4 o Shopify Analytics, no está resuelto aquí.
7. **Gráfico de Meta (Adquisición)** — 2 barras (Gasto, Ventas atribuidas) +
   2 líneas (Pedidos, ROAS promedio mensual). El pedido mensual de Meta
   ahora también trae conteo de compras (`getMetaMonthly` pide `actions`
   además de `action_values`).
8. **Diferenciar Meta vs. Google** — Meta usa la familia de azules de marca
   (`#086eb6`/`#4A9FD8`), Google usa una familia verde (`#1F7A5C`/`#34B37A`)
   deliberadamente distinta. **Asunción que tomé:** el doc solo mostró el
   gráfico de 2 barras + 2 líneas para Meta explícitamente — apliqué la
   misma estructura a Google por consistencia (hubiera sido raro que un
   gráfico tuviera 2 barras+2 líneas y el otro no). Si eso no era lo que
   querían para Google, es un cambio rápido revertir solo esa parte.
9. **Tabla de creativos** — 11 columnas nuevas: Inversión, Alcance,
   Impresiones, Frecuencia, CTR único, Visitas a la página, Costo por
   visita, Compras, Valor de compras, Costo por compra, ROAS. Se quitó
   "Clics". La tabla es ancha — hace scroll horizontal en pantallas
   angostas en vez de encoger las columnas hasta ser ilegibles.

## Top estados / Top productos: vuelve a ser 100% API en vivo de Shopify

Historia rápida por si algo de esto reaparece en el futuro: por un momento
(finales de agosto 2026) esto leyó de un Google Sheet que Plenlife
mantenía a mano. Se revirtió porque compartir ese Sheet con la cuenta de
servicio necesaria hubiera requerido exponer el archivo completo — y ese
archivo tiene más de 30 pestañas, varias con información sensible
(presupuestos, utilidad mensual, costos de producto) que no tenía nada que
ver con este dashboard. El cliente prefirió quedarse con la API en vivo de
Shopify, que ya estaba conectada y no requiere compartir nada adicional.

Estado actual:

- **Conector:** `lib/connectors/shopify.js` — funciones
  `getShopifyTopStatesByMonth(start, end)` y `getShopifyTopProductsByMonth(start, end)`.
- **Fuente:** pedidos reales de Shopify en el rango exacto seleccionado
  (`shippingAddress.province` para estados, `lineItems` para productos),
  excluyendo automáticamente pedidos cancelados y de prueba — mismo filtro
  que ya se aplica a todo lo demás en este conector.
- **Rango de fechas:** respeta el filtro de arriba (no está fijo a ningún
  mes). El resultado es un solo top 5 del periodo exacto elegido, etiquetado
  con las fechas (`2026-08-01 → 2026-08-16`, por ejemplo) — mismo formato
  que se usó brevemente con el Google Sheet, así que la UI no tuvo que
  cambiar al revertir esto.
- **Eficiencia:** como `getShopifyTotals()` y estas dos funciones piden
  pedidos del mismo rango en la misma petición, hay una memoización
  compartida (`getOrdersForRangeOnce`) para no traer los mismos pedidos de
  Shopify tres veces.
- **Aplican las mismas 2 limitaciones ya documentadas más abajo:** el límite
  de 60 días de historial de Shopify, y que los reembolsos no siempre se
  reflejan bien en los campos que usamos.

## El funnel de "checkout iniciado → compras" (Resumen Ejecutivo)

Este es un cambio importante respecto a versiones anteriores: el funnel ya
**no muestra "visitas a la página" ni "añadido al carrito"**. Se quitaron
esos dos pasos porque **no es posible obtenerlos de verdad desde la API de
Shopify** — son datos de analítica de sesión (requieren GA4 o el Pixel de
Shopify conectado aparte), no datos de pedidos/checkouts.

Lo que sí se muestra, con datos 100% reales de Shopify:
- **Checkout iniciado** = carritos abandonados (`abandonedCheckoutsCount`) + pedidos completados
- **Compras** = pedidos completados

⚠️ `abandonedCheckoutsCount` requiere, además del scope `read_orders`, el
permiso **`manage_abandoned_checkouts`** en tu app personalizada de Shopify.
Si ves un error de permisos en esta llamada específica, es casi seguro que
falta agregar ese permiso en la configuración de la app.

## Ranking de Creativos (Biblioteca de Creativos)

Solo Meta por ahora (Google PMax no expone miniaturas de creativo de forma
tan directa). Ordenado por ROAS descendente, top 5, excluyendo anuncios sin
gasto en el periodo (un ROAS sobre $0 de gasto no es un dato útil para
rankear). Cada fila hace una llamada adicional a Meta para traer la miniatura
del creativo — solo para los que sí entran al ranking final, no para toda la
cuenta.

## Cosas que quedaron fuera de esta vuelta (a propósito)

- **"Pacing"** (comparar gasto/ventas contra una meta mensual) se descartó —
  no existe ese número de meta en ningún lado del sistema todavía. Si más
  adelante quieren esto, lo más simple es una variable de entorno
  (`MONTHLY_SPEND_GOAL`) que se actualice cada mes.
- **"Costo por visita"** (en el panel de Adquisición vs. Retención) se
  muestra como "no disponible" — depende del mismo dato de visitas al sitio
  que el funnel no puede traer de Shopify. Mezclar ahí las visitas de Meta
  con el gasto total (Meta+Google) daría un número engañoso, así que se dejó
  honestamente vacío en vez de aproximado.
- **Cohortes de clientes** (retención por cosecha de adquisición mes a mes)
  no se implementó — es una funcionalidad grande por sí sola que merece su
  propio diseño y pase de trabajo, no algo para meter de prisa en esta ronda.

## ⚠️ Si los números de Shopify no cuadran contra otro reporte tuyo

**Bug corregido (agosto 2026):** los pedidos **cancelados** se estaban contando
de todas formas en ventas totales/netas y en el top de estados — un pedido
cancelado no es una venta, pero la consulta original no lo excluía. Ya se
arregló (`lib/connectors/shopify.js`, función `fetchOrdersInRange` filtra
`cancelledAt` y `test`). Si acabas de actualizar el dashboard y los números
bajaron respecto a antes, es justo por esto — revisa los logs de la función
`/api/shopify` en Vercel, ahí vas a ver cuántos pedidos se excluyeron por
rango de fecha.

**Bug corregido #2 (24 agosto 2026) — este era probablemente el más grande:**
Shopify GraphQL siempre regresa y filtra fechas de pedidos en **UTC**, pero
los reportes nativos de Shopify (Informes/Analytics) agrupan las ventas por
el **día calendario de la tienda** (hora de México). Un pedido de las 11pm
hora local ya cae en la madrugada del día siguiente en UTC — así que, sin
corregir esto, pedidos de última hora se contaban en el día equivocado, y en
los bordes de un rango de fechas hasta se podían perder pedidos completos.
Es un problema ampliamente documentado por otros desarrolladores en el foro
de Shopify. Ya se corrigió: la consulta pide un margen de 1 día extra a
Shopify, y luego filtra con precisión usando la zona horaria real de la
tienda (`SHOPIFY_STORE_TIMEZONE`, default `America/Mexico_City` — cámbiala
si la tienda usa otra zona). Esto afecta y mejora **todo** lo que depende de
fechas en este conector, no solo top estados/productos.

**Bug corregido #3 (25 agosto 2026) — este era el más grande de los tres:**
Confirmado con evidencia real (cliente comparó este dashboard contra un
reporte nativo de Shopify con los mismos estados/productos): la tienda de
Plenlife tiene **precios con IVA incluido** (`order.taxesIncluded = true`).
El campo que usábamos para "ventas netas" (`currentSubtotalPriceSet`) trae
ese IVA embebido, así que todo lo que llamábamos "ventas netas" en realidad
traía el 16% de más. Corregido: se divide entre `(1 + SHOPIFY_TAX_RATE)`
(default 0.16) cuando el pedido tiene `taxesIncluded=true`. Esto es una
aproximación por tasa fija, no una lectura exacta del monto de impuesto de
cada pedido — el campo exacto de Shopify para eso (`currentTotalTaxSet` o
similar) no se pudo confirmar con suficiente certeza como para arriesgar que
toda la consulta se rompiera por un nombre de campo equivocado. Si Plenlife
alguna vez tiene productos con tasas de IVA mixtas o pedidos exentos, esto
dejaría de ser exacto — avísame si eso pasa. "Ventas totales"
(`currentTotalPriceSet`) no cambió — esa sí debe incluir impuestos por
definición.

**Si después de los 3 fixes SIGUE sin cuadrar exactamente**, en orden de probabilidad:

1. **Límite de 60 días de Shopify.** Por default, una app solo puede ver
   pedidos de los últimos 60 días, a menos que tenga aprobado el scope
   `read_all_orders`. Si el rango que estás comparando se acerca o pasa esa
   ventana, el dashboard puede estar viendo *menos* pedidos de los que
   realmente existen — no un error, un vacío silencioso. Revisa en tu
   Partner Dashboard de Shopify si esa app tiene `read_all_orders` aprobado.
2. **Reembolsos que no se reflejan bien.** Los campos que usamos
   (`currentSubtotalPriceSet`/`currentTotalPriceSet`) *deberían* actualizarse
   solos cuando se hace un reembolso, pero hay reportes de comerciantes en el
   foro de desarrolladores de Shopify de casos donde esto no pasa
   correctamente. Si tienes pedidos con reembolsos parciales/totales en el
   periodo que estás comparando, ahí es donde yo miraría después.
3. **Definición distinta en tu otro dashboard.** Si ese otro reporte usa
   "ventas brutas" en vez de netas, incluye/excluye envío o impuestos
   distinto, o cuenta por fecha de *pago* en vez de fecha de *creación* del
   pedido, los números nunca van a coincidir exactamente aunque ambos estén
   "bien" — simplemente miden cosas ligeramente distintas.

## Filtro de fecha y comparación de periodos

Selector de fecha compartido entre las 4 pestañas (ver arriba). Todas las
tarjetas de KPI muestran cambio vs. el periodo anterior de la misma duración,
igual que antes. "Todo el histórico" no muestra comparación (no existe un
"anterior" al histórico completo). Para CPA/CAC el color se invierte (subir
es malo, bajar es bueno).

## Desplegar en Vercel

1. Sube este contenido a tu repo (reemplazando todo el contenido anterior —
   varias rutas y archivos cambiaron de lugar en esta versión).
2. Vercel detecta Next.js automáticamente vía la integración con GitHub.
3. Las variables de entorno ya configuradas (Meta, Google, Shopify) siguen
   funcionando igual — no hay que tocar nada ahí.

## Próximos pasos sugeridos

- Diseñar cohortes de clientes para Ventas y Clientes (retención por mes de adquisición).
- Decidir si "Costo por visita" se resuelve conectando GA4, o se deja fuera permanentemente.
- Si se retoma "Pacing", definir de dónde sale la meta mensual.
- Considerar extender el Ranking de Creativos a Google (si Google expone algo comparable para PMax).
