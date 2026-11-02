import { useState } from 'preact/hooks';
import { useStore, categoryMap } from '../store.js';
import { fmtEUR, dayLabel, norm, parseAmount, monthLabel, MONTHS_SHORT, MONTHS } from '../lib.js';
import { MonthNav, Segmented, TxRow, Icon } from '../components.jsx';

export default function Movements({ month, setMonth }) {
  const s = useStore();
  const cats = categoryMap(s);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('todos');
  const [method, setMethod] = useState('todos');
  const [catId, setCatId] = useState('');

  const query = norm(q);
  const searching = query.length > 0;
  const qAmount = /\d/.test(q) ? parseAmount(q) : 0;

  const list = s.transactions.filter((x) => {
    if (!searching && !x.date.startsWith(month)) return false;
    if (kind === 'gastos' && x.kind !== 'gasto') return false;
    if (kind === 'ingresos' && x.kind !== 'ingreso') return false;
    if (method !== 'todos' && x.method !== method) return false;
    if (catId && x.category_id !== catId) return false;
    if (searching) {
      const [y, m, d] = x.date.split('-');
      const hay = norm([x.concept, cats[x.category_id]?.name, x.date, `${+d}/${+m}/${y}`, `${+d} ${MONTHS_SHORT[m - 1]}`, MONTHS[m - 1], (x.amount_cents / 100).toFixed(2).replace('.', ',')].join(' '));
      const textOk = query.split(/\s+/).every((w) => hay.includes(w));
      const amountOk = qAmount > 0 && x.amount_cents === qAmount;
      if (!textOk && !amountOk) return false;
    }
    return true;
  });

  const groups = [];
  for (const x of list) {
    const g = groups[groups.length - 1];
    if (g && g.date === x.date) g.items.push(x); else groups.push({ date: x.date, items: [x] });
  }
  const total = list.reduce((a, x) => a + (x.kind === 'ingreso' ? x.amount_cents : -x.amount_cents), 0);
  const visibleCats = s.categories.filter((c) => kind === 'todos' || (kind === 'gastos' ? c.kind === 'gasto' : c.kind === 'ingreso'));

  return (
    <div class="page" style={{ maxWidth: '760px' }}>
      <div class="header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {searching && <span class="eyebrow">Todos los meses</span>}
          <h1 class="title">Movimientos</h1>
        </div>
        {!searching && <MonthNav month={month} setMonth={setMonth} />}
      </div>

      <label class="search">
        <span class="sr">Buscar movimientos</span>
        <Icon name="search" size={18} />
        <input class="input" type="search" placeholder="Buscar concepto, importe, fecha…" value={q} onInput={(e) => setQ(e.target.value)} />
      </label>

      <Segmented label="Tipo" value={kind} onChange={(v) => { setKind(v); setCatId(''); }} options={[['todos', 'Todos'], ['gastos', 'Gastos'], ['ingresos', 'Ingresos']]} />

      <div class="grid-2">
        <label class="field"><span class="sr">Cuenta</span>
          <select class="select" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="todos">Banco + efectivo</option>
            <option value="banco">Solo banco</option>
            <option value="efectivo">Solo efectivo</option>
          </select>
        </label>
        <label class="field"><span class="sr">Categoría</span>
          <select class="select" value={catId} onChange={(e) => setCatId(e.target.value)}>
            <option value="">Categorías</option>
            {visibleCats.map((c) => <option value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>

      <div class="bar-head muted" style={{ padding: '0 4px' }}>
        <span style={{ fontWeight: 600 }}>{list.length} {list.length === 1 ? 'movimiento' : 'movimientos'}</span>
        <span class="num" style={{ fontWeight: 800, color: 'var(--ink)' }}>{fmtEUR(total, { sign: true })}</span>
      </div>

      {groups.length === 0 && <p class="empty">{searching ? 'No hay resultados' : 'No hay movimientos este mes'}</p>}
      {groups.map((g) => (
        <div class="day-group">
          <span class="day-label">{dayLabel(g.date)}{searching ? ` ${g.date.slice(0, 4)}` : ''}</span>
          <div class="day-card list">
            {g.items.map((x) => <TxRow tx={x} cat={cats[x.category_id]} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
