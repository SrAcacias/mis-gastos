import { useState } from 'preact/hooks';
import { useStore, categoryMap } from '../store.js';
import { fmtEUR, dayLabel, norm, parseAmount, monthLabel, shortDate, MONTHS_SHORT, MONTHS } from '../lib.js';
import { MonthNav, Segmented, TxRow, TxTable, Icon } from '../components.jsx';

const SORTS = [['fecha', 'Fecha'], ['importe', 'Importe'], ['categoria', 'Categoría']];

export default function Movements({ month, setMonth, query = {} }) {
  const s = useStore();
  const cats = categoryMap(s);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState(['gastos', 'ingresos'].includes(query.tipo) ? query.tipo : 'todos');
  const [catId, setCatId] = useState(query.cat || '');
  const [sort, setSort] = useState('fecha');
  const [desc, setDesc] = useState(true);

  const text = norm(q);
  const searching = text.length > 0;
  const qAmount = /\d/.test(q) ? parseAmount(q) : 0;

  const list = s.transactions.filter((x) => {
    if (!searching && !x.date.startsWith(month)) return false;
    if (kind === 'gastos' && x.kind !== 'gasto') return false;
    if (kind === 'ingresos' && x.kind !== 'ingreso') return false;
    if (catId && x.category_id !== catId) return false;
    if (searching) {
      const [y, m, d] = x.date.split('-');
      const hay = norm([x.concept, cats[x.category_id]?.name, x.date, `${+d}/${+m}/${y}`, `${+d} ${MONTHS_SHORT[m - 1]}`, MONTHS[m - 1], (x.amount_cents / 100).toFixed(2).replace('.', ',')].join(' '));
      const textOk = text.split(/\s+/).every((w) => hay.includes(w));
      const amountOk = qAmount > 0 && x.amount_cents === qAmount;
      if (!textOk && !amountOk) return false;
    }
    return true;
  });

  // Orden
  const catName = (x) => cats[x.category_id]?.name || 'zzz';
  const cmp = {
    fecha: (a, b) => a.date.localeCompare(b.date) || (a.created_at || '').localeCompare(b.created_at || ''),
    importe: (a, b) => a.amount_cents - b.amount_cents,
    categoria: (a, b) => catName(a).localeCompare(catName(b), 'es') || b.date.localeCompare(a.date)
  }[sort];
  // Por categoría el sentido natural es A→Z; en fecha e importe, de mayor a menor
  const dir = sort === 'categoria' ? (desc ? 1 : -1) : (desc ? -1 : 1);
  const sorted = list.slice().sort((a, b) => dir * cmp(a, b));
  const pickSort = (v) => { if (v === sort) setDesc(!desc); else { setSort(v); setDesc(true); } };
  const dirLabel = sort === 'fecha' ? (desc ? 'Más recientes primero' : 'Más antiguos primero')
    : sort === 'importe' ? (desc ? 'Mayor importe primero' : 'Menor importe primero')
    : (desc ? 'A → Z' : 'Z → A');

  const groups = [];
  if (sort === 'fecha') for (const x of sorted) {
    const g = groups[groups.length - 1];
    if (g && g.date === x.date) g.items.push(x); else groups.push({ date: x.date, items: [x] });
  }
  const total = list.reduce((a, x) => a + (x.kind === 'ingreso' ? x.amount_cents : -x.amount_cents), 0);
  const visibleCats = s.categories.filter((c) => kind === 'todos' || (kind === 'gastos' ? c.kind === 'gasto' : c.kind === 'ingreso'));

  return (
    <div class="page movements">
      <div class="header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {searching && <span class="eyebrow">Todos los meses</span>}
          <h1 class="title">Movimientos</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {!searching && <MonthNav month={month} setMonth={setMonth} />}
          <a class="btn desktop-only" href="#/nuevo"><Icon name="plus" size={18} stroke={2.5} />Añadir movimiento</a>
        </div>
      </div>

      <div class="filters">
        <label class="search">
          <span class="sr">Buscar movimientos</span>
          <Icon name="search" size={18} />
          <input class="input" type="search" placeholder="Buscar concepto, importe, fecha…" value={q} onInput={(e) => setQ(e.target.value)} />
        </label>

        <Segmented label="Tipo" value={kind} onChange={(v) => { setKind(v); setCatId(''); }} options={[['todos', 'Todos'], ['gastos', 'Gastos'], ['ingresos', 'Ingresos']]} />

        <label class="field"><span class="sr">Categoría</span>
          <select class="select" value={catId} onChange={(e) => setCatId(e.target.value)}>
            <option value="">Todas las categorías</option>
            {visibleCats.map((c) => <option value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <div class="sort-row">
          <span class="muted" style={{ fontSize: '13px', fontWeight: 600 }}>Ordenar</span>
          <div class="sort-pills" role="group" aria-label="Ordenar por">
            {SORTS.map(([v, l]) => (
              <button type="button" class="sort-pill" aria-pressed={sort === v} onClick={() => pickSort(v)}>
                {l}{sort === v && <span aria-hidden="true">{desc ? ' ↓' : ' ↑'}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div class="bar-head muted" style={{ padding: '0 4px' }}>
        <span style={{ fontWeight: 600 }}>{list.length} {list.length === 1 ? 'movimiento' : 'movimientos'} · {dirLabel}</span>
        <span class="num" style={{ fontWeight: 800, color: 'var(--ink)' }}>{fmtEUR(total, { sign: true })}</span>
      </div>

      {list.length === 0 && <p class="empty">{searching ? 'No hay resultados' : `No hay movimientos en ${monthLabel(month).toLowerCase()}`}</p>}

      {list.length > 0 && <section class="card desktop-only"><TxTable list={sorted} cats={cats} showYear={searching} /></section>}

      {sort === 'fecha' ? groups.map((g) => (
        <div class="day-group mobile-only">
          <span class="day-label">{dayLabel(g.date)}{searching ? ` ${g.date.slice(0, 4)}` : ''}</span>
          <div class="day-card list">
            {g.items.map((x) => <TxRow tx={x} cat={cats[x.category_id]} />)}
          </div>
        </div>
      )) : list.length > 0 && (
        <div class="day-card list mobile-only">
          {sorted.map((x) => <TxRow tx={x} cat={cats[x.category_id]} showDate dateLabel={shortDate(x.date) + (searching ? ` ${x.date.slice(2, 4)}` : '')} />)}
        </div>
      )}
    </div>
  );
}
