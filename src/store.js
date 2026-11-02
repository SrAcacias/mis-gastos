// Capa de datos: Supabase (sincronizado) o localStorage (modo local)
import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'preact/hooks';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { uid, today, advanceDate, lastDayOfMonth, fuelCost, parseAmount, norm, toCSV, shortDate } from './lib.js';
import { SEED_CATEGORIES, SEED_RULES, SEED_CAR_LOGS } from './seed.js';

export const isLocal = !SUPABASE_URL || !SUPABASE_ANON_KEY;
export const supabase = isLocal ? null : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const TABLES = ['categories', 'recurring_rules', 'car_logs', 'transactions', 'settings'];

// ---------------- Backends ----------------
const LS_KEY = 'mis-gastos-local-v1';
const localDB = {
  read() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
  },
  write(db) { localStorage.setItem(LS_KEY, JSON.stringify(db)); },
  async select(t) { return (this.read()[t] || []).slice(); },
  async insert(t, rows) {
    const db = this.read(); db[t] = db[t] || [];
    const out = rows.map((r) => ({ id: uid(), user_id: 'local', created_at: new Date().toISOString(), ...r }));
    if (t === 'transactions') {
      for (const r of out) {
        if (r.recurring_id && db[t].some((x) => x.recurring_id === r.recurring_id && x.date === r.date)) throw { code: '23505' };
      }
    }
    db[t].push(...out); this.write(db); return out;
  },
  async update(t, id, patch) {
    const db = this.read(); const key = t === 'settings' ? 'user_id' : 'id';
    db[t] = (db[t] || []).map((r) => (r[key] === id ? { ...r, ...patch } : r)); this.write(db);
  },
  async remove(t, id) {
    const db = this.read(); db[t] = (db[t] || []).filter((r) => r.id !== id);
    if (t === 'car_logs') db.transactions = (db.transactions || []).filter((x) => x.car_log_id !== id);
    if (t === 'recurring_rules') db.transactions = (db.transactions || []).map((x) => (x.recurring_id === id ? { ...x, recurring_id: null } : x));
    if (t === 'categories') db.transactions = (db.transactions || []).map((x) => (x.category_id === id ? { ...x, category_id: null } : x));
    this.write(db);
  }
};

const remoteDB = {
  async select(t) {
    const all = []; const size = 1000;
    for (let from = 0; ; from += size) {
      const { data, error } = await supabase.from(t).select('*').range(from, from + size - 1);
      if (error) throw error;
      all.push(...data);
      if (data.length < size) break;
    }
    return all;
  },
  async insert(t, rows) {
    const out = [];
    for (let i = 0; i < rows.length; i += 500) {
      const { data, error } = await supabase.from(t).insert(rows.slice(i, i + 500)).select();
      if (error) throw error;
      out.push(...data);
    }
    return out;
  },
  async update(t, id, patch) {
    const key = t === 'settings' ? 'user_id' : 'id';
    const { error } = await supabase.from(t).update(patch).eq(key, id);
    if (error) throw error;
  },
  async remove(t, id) {
    const { error } = await supabase.from(t).delete().eq('id', id);
    if (error) throw error;
  }
};
const db = isLocal ? localDB : remoteDB;

// ---------------- Estado global ----------------
let state = {
  ready: false, loading: false, user: null, error: null,
  categories: [], transactions: [], rules: [], carLogs: [], settings: null
};
const listeners = new Set();
function set(patch) { state = { ...state, ...patch }; listeners.forEach((l) => l(state)); }
export const getState = () => state;

export function useStore() {
  const [s, setS] = useState(state);
  useEffect(() => { listeners.add(setS); setS(state); return () => listeners.delete(setS); }, []);
  return s;
}

// ---------------- Toast ----------------
let toastListeners = new Set();
export function toast(msg) { toastListeners.forEach((l) => l(msg)); }
export function useToast() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let t;
    const l = (m) => { setMsg(m); clearTimeout(t); t = setTimeout(() => setMsg(null), 2600); };
    toastListeners.add(l); return () => toastListeners.delete(l);
  }, []);
  return msg;
}

// ---------------- Auth ----------------
export async function initAuth() {
  if (isLocal) { set({ user: { id: 'local', email: 'Modo local' } }); await load(); return; }
  const { data } = await supabase.auth.getSession();
  set({ user: data.session?.user || null, ready: !data.session });
  if (data.session) await load();
  supabase.auth.onAuthStateChange((_e, session) => {
    const prev = state.user?.id;
    set({ user: session?.user || null });
    if (session?.user && session.user.id !== prev) load();
    if (!session) set({ ready: true, categories: [], transactions: [], rules: [], carLogs: [], settings: null });
  });
}
export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}
export async function signOut() { if (!isLocal) await supabase.auth.signOut(); }

// ---------------- Carga y sincronización ----------------
const sortTx = (a, b) => (a.date === b.date ? (b.created_at || '').localeCompare(a.created_at || '') : b.date.localeCompare(a.date));

export async function load({ silent = false } = {}) {
  if (!state.user || state.loading) return;
  set({ loading: true, ...(silent ? {} : {}) });
  try {
    const [categories, rules, carLogs, transactions, settingsRows] = await Promise.all(TABLES.map((t) => db.select(t)));
    let settings = settingsRows[0];
    if (!settings) {
      [settings] = await db.insert('settings', [{ ...(isLocal ? { user_id: 'local' } : {}), theme: 'teal', mode: 'light', km_per_l: 16.67, seeded: false }]);
    }
    set({
      categories: categories.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)),
      rules, carLogs: carLogs.sort((a, b) => b.month.localeCompare(a.month)),
      transactions: transactions.sort(sortTx), settings, error: null
    });
    applyTheme(settings);
    if (!settings.seeded) await seed();
    await runRecurring();
  } catch (e) {
    console.error(e);
    set({ error: e.message || String(e) });
  } finally {
    set({ loading: false, ready: true });
  }
}

// Al volver a la app (cambiar de pestaña, abrir el iPhone…) se vuelve a leer todo
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load({ silent: true }); });
}

async function seed() {
  const cats = await db.insert('categories', SEED_CATEGORIES.map((c, i) => ({ ...c, sort: i })));
  const byName = Object.fromEntries(cats.map((c) => [c.name, c.id]));
  const rules = await db.insert('recurring_rules', SEED_RULES.map(({ category, ...r }) => ({ ...r, category_id: byName[category] || null })));
  const logs = await db.insert('car_logs', SEED_CAR_LOGS);
  await db.update('settings', state.settings.user_id, { seeded: true });
  set({
    categories: cats, rules, carLogs: logs.concat(state.carLogs),
    settings: { ...state.settings, seeded: true }
  });
}

// Genera los movimientos de los recurrentes que ya han vencido
let recurringRunning = false;
async function runRecurring() {
  if (recurringRunning) return;
  recurringRunning = true;
  try {
    const t = today(); let added = []; const rules = [];
    for (const r of state.rules) {
      if (!r.active || r.next_date > t) { rules.push(r); continue; }
      let next = r.next_date; let guard = 0;
      while (next <= t && guard++ < 60) {
        const exists = state.transactions.some((x) => x.recurring_id === r.id && x.date === next);
        if (!exists) {
          try {
            const [row] = await db.insert('transactions', [{
              date: next, kind: r.kind, concept: r.concept, category_id: r.category_id,
              amount_cents: r.amount_cents, method: r.method, recurring_id: r.id, is_fixed: true
            }]);
            added.push(row);
          } catch (e) { if (e.code !== '23505') throw e; }
        }
        next = advanceDate(next, r.frequency);
      }
      await db.update('recurring_rules', r.id, { next_date: next });
      rules.push({ ...r, next_date: next });
    }
    if (added.length) set({ transactions: state.transactions.concat(added).sort(sortTx) });
    set({ rules });
  } finally { recurringRunning = false; }
}

// ---------------- Movimientos ----------------
export async function addTransaction(tx) {
  const [row] = await db.insert('transactions', [tx]);
  set({ transactions: state.transactions.concat(row).sort(sortTx) });
  return row;
}
export async function updateTransaction(id, patch) {
  await db.update('transactions', id, patch);
  set({ transactions: state.transactions.map((x) => (x.id === id ? { ...x, ...patch } : x)).sort(sortTx) });
}
export async function deleteTransaction(id) {
  await db.remove('transactions', id);
  set({ transactions: state.transactions.filter((x) => x.id !== id) });
}
// Editar un recurrente: "este y siguientes" cambia la regla y los movimientos desde esta fecha
export async function updateRecurringFrom(tx, patch) {
  const rulePatch = {};
  for (const k of ['concept', 'category_id', 'amount_cents', 'method', 'kind']) if (k in patch) rulePatch[k] = patch[k];
  await db.update('recurring_rules', tx.recurring_id, rulePatch);
  const targets = state.transactions.filter((x) => x.recurring_id === tx.recurring_id && x.date >= tx.date);
  for (const x of targets) await db.update('transactions', x.id, x.id === tx.id ? patch : rulePatch);
  set({
    rules: state.rules.map((r) => (r.id === tx.recurring_id ? { ...r, ...rulePatch } : r)),
    transactions: state.transactions.map((x) => (x.id === tx.id ? { ...x, ...patch } : targets.includes(x) ? { ...x, ...rulePatch } : x)).sort(sortTx)
  });
}

// ---------------- Categorías ----------------
export async function saveCategory(cat) {
  if (cat.id) {
    const { id, ...patch } = cat;
    await db.update('categories', id, patch);
    set({ categories: state.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  } else {
    const [row] = await db.insert('categories', [{ ...cat, sort: state.categories.length }]);
    set({ categories: state.categories.concat(row) });
    return row;
  }
}
export async function deleteCategory(id, reassignTo) {
  const affected = state.transactions.filter((x) => x.category_id === id);
  for (const x of affected) await db.update('transactions', x.id, { category_id: reassignTo || null });
  for (const r of state.rules.filter((r) => r.category_id === id)) await db.update('recurring_rules', r.id, { category_id: reassignTo || null });
  await db.remove('categories', id);
  set({
    categories: state.categories.filter((c) => c.id !== id),
    transactions: state.transactions.map((x) => (x.category_id === id ? { ...x, category_id: reassignTo || null } : x)),
    rules: state.rules.map((r) => (r.category_id === id ? { ...r, category_id: reassignTo || null } : r))
  });
}

// ---------------- Recurrentes ----------------
export async function saveRule(rule) {
  if (rule.id) {
    const { id, ...patch } = rule;
    await db.update('recurring_rules', id, patch);
    set({ rules: state.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  } else {
    const [row] = await db.insert('recurring_rules', [rule]);
    set({ rules: state.rules.concat(row) });
  }
  await runRecurring();
}
export async function deleteRule(id) {
  // Los movimientos ya creados siguen contando como fijos
  for (const x of state.transactions.filter((x) => x.recurring_id === id && !x.is_fixed)) await db.update('transactions', x.id, { is_fixed: true });
  state = { ...state, transactions: state.transactions.map((x) => (x.recurring_id === id ? { ...x, is_fixed: true } : x)) };
  await db.remove('recurring_rules', id);
  set({
    rules: state.rules.filter((r) => r.id !== id),
    transactions: state.transactions.map((x) => (x.recurring_id === id ? { ...x, recurring_id: null } : x))
  });
}

// ---------------- Coche ----------------
export async function saveCarLog(log) {
  const fields = {
    month: log.month, km_start: log.km_start ?? null, km_end: log.km_end ?? null,
    price_per_l: log.price_per_l ?? null, km_per_l: log.km_per_l ?? state.settings.km_per_l
  };
  let saved;
  const existing = state.carLogs.find((l) => l.month === fields.month);
  if (existing) { await db.update('car_logs', existing.id, fields); saved = { ...existing, ...fields }; }
  else { [saved] = await db.insert('car_logs', [fields]); }
  set({ carLogs: state.carLogs.filter((l) => l.id !== saved.id).concat(saved).sort((a, b) => b.month.localeCompare(a.month)) });

  // Gasto de gasolina vinculado
  const { km, cents } = fuelCost(saved);
  const tx = state.transactions.find((x) => x.car_log_id === saved.id);
  const coche = state.categories.find((c) => c.kind === 'gasto' && norm(c.name) === 'coche');
  const data = {
    date: lastDayOfMonth(saved.month), kind: 'gasto', concept: `Gasolina (${km.toLocaleString('es-ES')} km)`,
    amount_cents: cents, method: 'banco', category_id: tx?.category_id || coche?.id || null, car_log_id: saved.id
  };
  if (cents > 0) {
    if (tx) await updateTransaction(tx.id, data); else await addTransaction(data);
  } else if (tx) await deleteTransaction(tx.id);

  // Prepara el mes siguiente con los km de inicio
  if (saved.km_end) {
    const [y, m] = saved.month.split('-').map(Number);
    const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`;
    const n = state.carLogs.find((l) => l.month === next);
    if (n && n.km_start !== saved.km_end) {
      await db.update('car_logs', n.id, { km_start: saved.km_end });
      set({ carLogs: state.carLogs.map((l) => (l.id === n.id ? { ...l, km_start: saved.km_end } : l)) });
      const nl = state.carLogs.find((l) => l.id === n.id);
      if (nl.km_end) await saveCarLog(nl);
    }
  }
  return saved;
}
export async function deleteCarLog(id) {
  await db.remove('car_logs', id);
  set({ carLogs: state.carLogs.filter((l) => l.id !== id), transactions: state.transactions.filter((x) => x.car_log_id !== id) });
}

// ---------------- Ajustes y tema ----------------
export async function updateSettings(patch) {
  await db.update('settings', state.settings.user_id, patch);
  const settings = { ...state.settings, ...patch };
  set({ settings });
  applyTheme(settings);
}

export const THEMES = {
  teal:   { name: 'Verde azulado', light: '#0F766E', dark: '#2DD4BF' },
  blue:   { name: 'Azul',          light: '#1D4ED8', dark: '#60A5FA' },
  orange: { name: 'Naranja',       light: '#C2410C', dark: '#FB923C' },
  purple: { name: 'Morado',        light: '#6D28D9', dark: '#A78BFA' },
  slate:  { name: 'Grafito',       light: '#374151', dark: '#D1D5DB' }
};
let mq;
export function applyTheme(s) {
  if (typeof document === 'undefined' || !s) return;
  try { localStorage.setItem('mis-gastos-theme', JSON.stringify({ theme: s.theme, mode: s.mode })); } catch {}
  const root = document.documentElement;
  mq = mq || window.matchMedia('(prefers-color-scheme: dark)');
  const dark = s.mode === 'dark' || (s.mode === 'auto' && mq.matches);
  root.dataset.mode = dark ? 'dark' : 'light';
  root.dataset.theme = THEMES[s.theme] ? s.theme : 'teal';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0B0F14' : '#F4F5F7');
  mq.onchange = () => state.settings && applyTheme(state.settings);
}

export async function createShortcutToken() {
  const bytes = new Uint8Array(24); crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await updateSettings({ shortcut_token: token });
  return token;
}

// ---------------- Importar / exportar CSV ----------------
export const CSV_HEADERS = ['fecha', 'tipo', 'concepto', 'categoria', 'importe', 'cuenta', 'fijo'];

export function exportCSV({ from, to } = {}) {
  const cats = Object.fromEntries(state.categories.map((c) => [c.id, c.name]));
  const rows = state.transactions
    .filter((x) => (!from || x.date >= from) && (!to || x.date <= to))
    .slice().sort((a, b) => a.date.localeCompare(b.date))
    .map((x) => ({
      fecha: x.date, tipo: x.kind, concepto: x.concept, categoria: cats[x.category_id] || '',
      importe: (x.amount_cents / 100).toFixed(2).replace('.', ','), cuenta: x.method === 'efectivo' ? 'Efectivo' : 'Banco',
      fijo: isFixed(x) ? 'sí' : 'no'
    }));
  return toCSV(rows, CSV_HEADERS);
}

export async function importRows(rows) {
  const key = (d, k, c, a) => `${d}|${k}|${a}|${norm(c)}`;
  const seen = new Set(state.transactions.map((x) => key(x.date, x.kind, x.concept, x.amount_cents)));
  const toInsert = []; let skipped = 0; let invalid = 0;
  for (const r of rows) {
    const date = (r.fecha || r.date || '').slice(0, 10);
    const kind = norm(r.tipo || r.kind).startsWith('ingreso') ? 'ingreso' : 'gasto';
    const amount = Math.abs(parseAmount(r.importe || r.amount));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !amount) { invalid++; continue; }
    const concept = r.concepto || r.concept || '';
    const k = key(date, kind, concept, amount);
    // Solo se saltan los que ya estaban guardados (dentro del archivo puede haber dos gastos iguales el mismo día)
    if (seen.has(k)) { skipped++; continue; }
    let catName = (r.categoria || r.category || '').trim();
    let cat = catName && state.categories.find((c) => c.kind === kind && norm(c.name) === norm(catName));
    if (catName && !cat) cat = await saveCategory({ name: catName, kind, color: kind === 'ingreso' ? '#0F766E' : '#6B7280' });
    toInsert.push({
      date, kind, concept, amount_cents: amount, category_id: cat?.id || null,
      method: norm(r.cuenta || r.method).startsWith('efect') ? 'efectivo' : 'banco',
      is_fixed: ['si', 'sí', 'true', '1', 'x'].includes(norm(r.fijo))
    });
  }
  if (toInsert.length) {
    const rowsIn = await db.insert('transactions', toInsert);
    set({ transactions: state.transactions.concat(rowsIn).sort(sortTx) });
  }
  return { added: toInsert.length, skipped, invalid };
}

// ---------------- Consultas ----------------
export const isFixed = (x) => !!(x.recurring_id || x.is_fixed);
export function categoryMap(s = state) { return Object.fromEntries(s.categories.map((c) => [c.id, c])); }
export function monthTotals(transactions, month) {
  let inc = 0, exp = 0, fixed = 0;
  for (const x of transactions) if (x.date.startsWith(month)) {
    if (x.kind === 'ingreso') inc += x.amount_cents;
    else { exp += x.amount_cents; if (isFixed(x)) fixed += x.amount_cents; }
  }
  return { inc, exp, bal: inc - exp, fixed, variable: exp - fixed };
}
export { shortDate };
