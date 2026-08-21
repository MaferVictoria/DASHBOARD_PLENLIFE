// Google Sheets connector — reads Plenlife's manually-maintained Shopify
// sales export for "Top estados" and "Top productos", INSTEAD of computing
// them from the live Shopify Orders API.
//
// This was a deliberate choice, not a technical shortcut: the person who
// maintains this Sheet already reconciles it against Shopify's own "Sales"
// report (cancellations, refunds, etc. are already handled upstream by
// Shopify's own reporting engine), so for these two specific views it can
// be more trustworthy than a live Orders API pull. Everything else in the
// dashboard (KPI totals, monthly charts, checkout funnel, new customers)
// stays on the live Shopify connector — this file ONLY covers top
// estados/productos, by design (confirmed with the client).
//
// Reads credentials from Vercel Environment Variables:
//   GOOGLE_SHEETS_CLIENT_EMAIL   → service account email (from the JSON key file)
//   GOOGLE_SHEETS_PRIVATE_KEY    → service account private key (same file — keep
//                                   the literal "\n" sequences, they're unescaped below)
//   GOOGLE_SHEETS_SPREADSHEET_ID → the long ID in the sheet's URL
//   GOOGLE_SHEETS_TAB_NAME       → optional, defaults to "Input Shopify Ventas 2026"
//
// If credentials are missing, falls back to mock data. If credentials ARE
// present but the read fails, throws — same "visible error over silent fake
// numbers" pattern as every other connector in this project.
//
// COLUMN LAYOUT (as of Aug 2026 — update this if the sheet's columns are
// ever reordered/renamed; there's no way for this code to detect that on
// its own since it reads by column position, not by header name):
//   A (0): Título del producto     E (4): Región del envío (estado)
//   D (3): Día (fecha)             I (8): Ventas netas
//                                  Q (16): MES (1-12)
//
// The sheet has section-header rows scattered through it (e.g. a row that
// just says "ENERO", or repeated column-header rows) rather than one clean
// header + data block. Rather than assume where those are, every row is
// checked with isDataRow() before use — a row only counts if it has a
// product name AND a valid MES number, which naturally skips the
// non-data rows wherever they happen to be.

import crypto from 'crypto';
import { mockTopStatesByMonth, mockTopProductsByMonth } from '../mockData';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DEFAULT_TAB = 'Input Shopify Ventas 2026';
const COL = { PRODUCT: 0, STATE: 4, NET_SALES: 8, MONTH_NUM: 16 };

function hasCredentials() {
  return Boolean(
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL &&
      process.env.GOOGLE_SHEETS_PRIVATE_KEY &&
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  );
}

function round(n) {
  return Math.round(n);
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Service accounts authenticate via a self-signed JWT exchanged for an
// access token — no user consent screen, no refresh token to manage.
async function getAccessToken() {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  // Vercel env vars are single-line, so the key's real newlines arrive as
  // literal "\n" two-character sequences — restore them before signing.
  const privateKey = (process.env.GOOGLE_SHEETS_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claimSet))}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  sign.end();
  const signature = sign.sign(privateKey).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Google Sheets auth: ${json.error_description || json.error || `HTTP ${res.status}`}`);
  }
  return json.access_token;
}

async function fetchSheetRows() {
  const accessToken = await getAccessToken();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const tabName = process.env.GOOGLE_SHEETS_TAB_NAME || DEFAULT_TAB;
  // UNFORMATTED_VALUE gives raw numbers ($1,193.40 -> 1193.4) instead of
  // display strings, so no currency-string parsing is needed downstream.
  const range = encodeURIComponent(`${tabName}!A1:Q20000`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json();
  if (!res.ok) {
    const message = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Google Sheets API: ${message}`);
  }
  return json.values || [];
}

// In-flight memoization so a single request calling BOTH
// getTopStatesByMonthFromSheet() and getTopProductsByMonthFromSheet() (which
// the /api/shopify route does via Promise.all) reads the sheet once, not twice.
let _rowsPromise = null;
let _rowsPromiseAt = 0;

function getSheetRowsOnce() {
  const now = Date.now();
  if (_rowsPromise && now - _rowsPromiseAt < 5000) return _rowsPromise;
  _rowsPromiseAt = now;
  _rowsPromise = fetchSheetRows();
  return _rowsPromise;
}

function isDataRow(row) {
  const monthNum = Number(row[COL.MONTH_NUM]);
  return Boolean(row[COL.PRODUCT]) && monthNum >= 1 && monthNum <= 12;
}

// [previousMonthNumber, currentMonthNumber] — matches the "mes actual y
// anterior, fijo" convention already used everywhere else in the dashboard.
function currentAndPreviousMonthNumbers() {
  const now = new Date();
  const current = now.getMonth() + 1; // JS months are 0-indexed; sheet's MES column is 1-indexed
  const previous = current === 1 ? 12 : current - 1;
  return [previous, current];
}

export async function getTopStatesByMonthFromSheet() {
  if (!hasCredentials()) {
    console.warn('[google sheets connector] Missing credentials — using mock data.');
    return mockTopStatesByMonth();
  }

  const rows = await getSheetRowsOnce();
  const targetMonths = currentAndPreviousMonthNumbers();

  const byMonth = {}; // { monthNum: { [state]: sales } }
  rows.forEach((row) => {
    if (!isDataRow(row)) return;
    const monthNum = Number(row[COL.MONTH_NUM]);
    if (!targetMonths.includes(monthNum)) return;
    const state = row[COL.STATE];
    if (!state) return; // blank = no sale that day for that product
    const sales = Number(row[COL.NET_SALES]) || 0;
    byMonth[monthNum] = byMonth[monthNum] || {};
    byMonth[monthNum][state] = (byMonth[monthNum][state] || 0) + sales;
  });

  return targetMonths.map((monthNum) => {
    const states = Object.entries(byMonth[monthNum] || {})
      .map(([state, sales]) => ({ state, sales: round(sales) }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);
    return { month: MONTH_LABELS[monthNum - 1], states };
  });
}

export async function getTopProductsByMonthFromSheet() {
  if (!hasCredentials()) {
    console.warn('[google sheets connector] Missing credentials — using mock data.');
    return mockTopProductsByMonth();
  }

  const rows = await getSheetRowsOnce();
  const targetMonths = currentAndPreviousMonthNumbers();

  const byMonth = {}; // { monthNum: { [product]: sales } }
  rows.forEach((row) => {
    if (!isDataRow(row)) return;
    const monthNum = Number(row[COL.MONTH_NUM]);
    if (!targetMonths.includes(monthNum)) return;
    const sales = Number(row[COL.NET_SALES]) || 0;
    if (sales <= 0) return; // skip the many $0 rows for products not sold that day
    const product = row[COL.PRODUCT];
    byMonth[monthNum] = byMonth[monthNum] || {};
    byMonth[monthNum][product] = (byMonth[monthNum][product] || 0) + sales;
  });

  return targetMonths.map((monthNum) => {
    const products = Object.entries(byMonth[monthNum] || {})
      .map(([product, sales]) => ({ product, sales: round(sales) }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);
    return { month: MONTH_LABELS[monthNum - 1], products };
  });
}
