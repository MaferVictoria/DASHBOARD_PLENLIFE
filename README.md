# Dashboard Plato Express — Paid Media & Pipeline Comercial

## Qué hay en este repo
```
index.html              ← el dashboard completo (una sola página, sin build step)
api/google-ads-data.js  ← función serverless de Vercel para Google Ads
```

## Estado actual
- **Pipeline comercial:** en vivo, leyendo directo del Google Sheet "Plato - LEADS" (pestaña "Hoja 1").
- **Google Ads:** conectado en vivo. Ver sección 6 para exactamente qué alimenta y qué no.

## 1. Desplegar en Vercel
1. Sube este contenido a un repo de GitHub.
2. En Vercel: **Add New → Project → Import** ese repo.
3. Framework preset: "Other" (es HTML estático, no necesita build).
4. Deploy.

## 2. Variables de entorno (Google Ads)
En Vercel → tu proyecto → **Settings → Environment Variables**:

| Variable | De dónde sale |
|---|---|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads → Herramientas → Centro de API (legado; Google ya no lo exige desde el 9-sept-2026, pero no hace daño mantenerlo) |
| `GOOGLE_ADS_CLIENT_ID` | Google Cloud Console → Credenciales OAuth (tipo **"Aplicación web"**) |
| `GOOGLE_ADS_CLIENT_SECRET` | mismo lugar que el Client ID |
| `GOOGLE_ADS_REFRESH_TOKEN` | se genera vía OAuth Playground con el Client ID/Secret de arriba |
| `GOOGLE_ADS_CUSTOMER_ID` | ID de la cuenta de Plato Express en Google Ads (sin guiones) |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | ID del MCC (sin guiones) |

Importante: desde sept-2026 el nivel de acceso de la API ya no se pide en Google Ads, sino en Google Cloud Console → `console.cloud.google.com/google/ads-apis/overview`, dentro del MISMO proyecto que usaste para las credenciales OAuth. Nivel "Explorador" es suficiente para todo lo que hace este dashboard.

## 3. Columna "Correo" (para MQL)
La columna **"Correo"** en el Sheet "Plato - LEADS" (Hoja 1) es la que determina MQL. Mientras un lead no tenga correo capturado, cuenta como Lead pero no como MQL.

Dominios que **no** cuentan como correo de empresa (constante `PERSONAL_EMAIL_DOMAINS` en el código): gmail, hotmail, outlook (incl. .com.mx), live, yahoo, icloud, msn, aol, protonmail, gmx, y el dominio interno de la agencia (`rockinmedia.com` / `.mx`).

## 4. Fuentes de datos (IDs)
- Pipeline: Sheet `1QEZ_w30onOHOLN_VJ4pUt5e90LC9z4ZXILa5Qz7vrA8`, pestaña `Hoja 1`.
- Google Ads (Sheet, ver sección 6): Sheet `1ToVcoGqYLd3PR6HghpyjQrVPCWEttkBbSxG2wKigwaI`, pestañas `Resumen mensual` y `Resumen mensual por plaza`.

Ambos Sheets deben mantenerse compartidos como "Cualquier persona con el enlace puede ver".

## 5. Embudo

- **Lead:** toda fila del Sheet de leads.
- **MQL:** correo de dominio empresarial.
- **SQL** (ambas rutas exigen correo empresarial):
  1. ≥400 empleados **y** ≥1 turno, **o**
  2. 200-399 empleados **y** exactamente 1 turno.
- **Posible SQL** (entre MQL y SQL): cualquiera de estas dos rutas —
  1. 200-399 empleados **y** 2-5 turnos (sin importar el correo), **o**
  2. ≥200 empleados **y** sin correo empresarial.

Estas fórmulas están diseñadas para que SQL y Posible SQL **nunca se traslapen** — probado con los casos límite (400 vs. 399 empleados, 1 vs. 2 turnos, con y sin correo).

## 6. De dónde sale cada número (arquitectura de fuentes — importante)

Google Ads en vivo **sólo** alimenta 3 cosas (decisión explícita del cliente):
1. La tarjeta **Gasto** (Resumen Ejecutivo).
2. La tarjeta **Conversiones** y **CPA · Lead** (Gasto ÷ Conversiones, ambos en vivo).
3. La pestaña **Palabras clave** (no existe en ningún Sheet; si la API no responde, esa pestaña muestra un aviso en vez de una tabla vacía).

**Todo lo demás** — MQL, Posible SQL, SQL, sus CPA, la tabla y gráficas mensuales, "Detalle de Leads" y "Por plaza" — sigue viniendo de los Google Sheets, sin importar si Google Ads en vivo está funcionando o no. El Gasto usado para CPA·MQL/Posible SQL/SQL es siempre el del Sheet "Resumen mensual", nunca el de la API.

Por eso vas a ver dos números de "Gasto" ligeramente distintos en el dashboard (la tarjeta de arriba en vivo, vs. la tabla mensual con el del Sheet) — es intencional, no un error.

## 7. Pestaña "Por plaza"
Ahora son 3 plazas, y el gasto sale de Google Ads en vivo (ya no de un Sheet):

- **Nuevo León** (incluye leads de Coahuila) — campañas: `RO_MX_PMX_PRO_MTY&COA_ComedoresIndustriales`, `Plato Express | 2023 | MTY-COA`
- **San Luis Potosí y Guanajuato** — campañas: `RO_MX_SEA_PRO_SLP&MX&LG_ComedoresIndustriales`, `RO_MX_SEA_PRO_LG_ComedoresIndustriales`, `RO_MX_PMX_PRO_SLP&LG_ComedoresIndustriales`
- **CDMX y Estado de México** — campaña: `RO_MX_SEA_PRO_CDMX_ComedoresIndustriales`

El gasto se calcula emparejando el nombre EXACTO de campaña (constante `CAMPAIGN_PLAZA_MAP` en el código) contra `campaignDaily` de la API en vivo. Cualquier campaña que no esté en esa lista (nacionales, de marca, etc.) simplemente no se cuenta para este desglose. **No tiene respaldo en Sheets** — si la API no está conectada, la pestaña avisa que el gasto por plaza no está disponible en vez de mostrar $0 engañoso.

Los leads siguen viniendo del Sheet "Plato - LEADS", columna "Ciudad", agrupados en estas mismas 3 plazas (más "Otra plaza" para ciudades no reconocidas). Hay un selector en la pestaña para ver una plaza a la vez o todas juntas.

Si se agregan o renombran campañas de plaza a futuro, hay que actualizar `CAMPAIGN_PLAZA_MAP` en `index.html`.

## 8. Pestaña "Palabras clave"
Por cada palabra clave configurada en la cuenta (las que activan la pauta): Estado (Activa/Pausada/Removida), Impresiones, Interacciones, % Interacción, Costo promedio, Costo, % Conversión, Conversiones, Costo por conversión. Sólo funciona con la API en vivo conectada.

## 9. Bug corregido: filas sin fecha
Una fila con "Fecha" vacía en el Sheet de leads (ej. una fila en blanco) hacía que TODO el conteo de Leads/MQL/Posible SQL/SQL se fuera a 0, sin ningún aviso. Ya está corregido: esas filas se ignoran solas.

**Si algún mes te sigue pareciendo con menos leads de los que esperabas**, revisa si hay un filtro activo (ícono de embudo) en alguna columna de "Hoja 1" — un filtro activo hace que Sheets sólo entregue las filas visibles, no todas. Datos → Quitar filtro si ves uno.

## 10. Otros detalles
- El agrupamiento mensual de leads usa la columna **"Mes"** del Sheet (no la fecha).
- Hay botones de "Mes específico" en el filtro de periodo, uno por cada mes con datos.
- La pestaña "Resumen mensual" del Sheet de Ads sólo trae 2026 (se quitó 2025 para que las gráficas se lean mejor).
