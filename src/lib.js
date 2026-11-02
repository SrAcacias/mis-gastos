// Utilidades: dinero, fechas, CSV

export const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
export const MONTHS_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
export const WEEKDAYS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

export function fmtEUR(cents, { sign = false } = {}) {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const ent = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dec = String(abs % 100).padStart(2, '0');
  const pre = neg ? '−' : (sign && cents > 0 ? '+' : '');
  return `${pre}${ent},${dec} €`;
}

// "12,5" | "12.50" | "1.234,56" → céntimos
export function parseAmount(str) {
  if (typeof str === 'number') return Math.round(str * 100);
  let s = String(str || '').trim().replace(/[€\s]/g, '');
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function centsToInput(c) {
  if (!c) return '';
  return (c / 100).toFixed(2).replace('.', ',').replace(/,00$/, '');
}

export const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => isoDate(new Date());
export const monthOf = (iso) => iso.slice(0, 7);
export const currentMonth = () => monthOf(today());

export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function lastDayOfMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${pad(new Date(y, m, 0).getDate())}`;
}
// Avanza una fecha 1 mes (o 1 año) conservando el día cuando existe
export function advanceDate(iso, frequency = 'monthly') {
  const [y, m, d] = iso.split('-').map(Number);
  const ny = frequency === 'yearly' ? y + 1 : (m === 12 ? y + 1 : y);
  const nm = frequency === 'yearly' ? m : (m === 12 ? 1 : m + 1);
  const max = new Date(ny, nm, 0).getDate();
  return `${ny}-${pad(nm)}-${pad(Math.min(d, max))}`;
}
export function monthLabel(month, short = false) {
  const [y, m] = month.split('-').map(Number);
  const name = (short ? MONTHS_SHORT : MONTHS)[m - 1];
  return short ? `${name} ${String(y).slice(2)}` : `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
}
export function dayLabel(iso) {
  const t = today();
  const y = isoDate(new Date(Date.now() - 864e5));
  if (iso === t) return 'Hoy';
  if (iso === y) return 'Ayer';
  const [yy, mm, dd] = iso.split('-').map(Number);
  const w = WEEKDAYS[new Date(yy, mm - 1, dd).getDay()];
  return `${w[0].toUpperCase()}${w.slice(1)}, ${dd} ${MONTHS_SHORT[mm - 1]}`;
}
export const shortDate = (iso) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
};

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }));

export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// ---------- CSV ----------
export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const clean = rows.filter((r) => r.some((v) => v.trim() !== ''));
  if (!clean.length) return [];
  const head = clean[0].map((h) => norm(h));
  return clean.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

export function toCSV(rows, headers) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [headers.join(';'), ...rows.map((r) => headers.map((h) => esc(r[h])).join(';'))].join('\r\n');
}

export function downloadFile(name, content, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------- Gasolina ----------
export function fuelCost({ km_start, km_end, price_per_l, km_per_l }) {
  const km = (km_end ?? 0) - (km_start ?? 0);
  if (!km_end || !km_start || km <= 0 || !price_per_l || !km_per_l) return { km: Math.max(km, 0), litres: 0, cents: 0 };
  const litres = km / Number(km_per_l);
  return { km, litres, cents: Math.round(litres * Number(price_per_l) * 100) };
}
