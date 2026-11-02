import { useStore, categoryMap, monthTotals } from '../store.js';
import { fmtEUR, currentMonth, addMonths, monthLabel, shortDate } from '../lib.js';
import { MonthNav, TxRow, TxTable, Icon } from '../components.jsx';

export default function Summary({ month, setMonth }) {
  const s = useStore();
  const cats = categoryMap(s);
  const { inc, exp, bal } = monthTotals(s.transactions, month);
  const prev = monthTotals(s.transactions, addMonths(month, -1));
  const monthTx = s.transactions.filter((x) => x.date.startsWith(month));

  const byCat = {};
  for (const x of monthTx) if (x.kind === 'gasto') byCat[x.category_id || ''] = (byCat[x.category_id || ''] || 0) + x.amount_cents;
  const rows = Object.entries(byCat).map(([id, cents]) => ({ id, cents, name: cats[id]?.name || 'Sin categoría' })).sort((a, b) => b.cents - a.cents);
  const max = rows[0]?.cents || 1;

  // Aviso de km pendientes
  const cm = currentMonth();
  const pending = s.carLogs.filter((l) => l.month < cm && !l.km_end).sort((a, b) => a.month.localeCompare(b.month));
  const prevMonth = addMonths(cm, -1);
  const missingPrev = s.carLogs.length > 0 && !s.carLogs.some((l) => l.month === prevMonth);
  const diff = prev.exp ? Math.round(((exp - prev.exp) / prev.exp) * 100) : null;

  const notice = (pending.length > 0 || missingPrev) && (
    <a class="notice" href="#/coche">
      <Icon name="car" size={20} />
      <span>Faltan los km del coche de {(pending[0]?.month ? monthLabel(pending[0].month) : monthLabel(prevMonth)).toLowerCase()}</span>
    </a>
  );

  const categories = (
    <section class="card">
      <h2 class="card-title">Gastos por categoría</h2>
      {rows.length === 0 && <p class="empty">Sin gastos este mes</p>}
      {rows.map((r) => (
        <a class="bar-row link-row" href={`#/movimientos?tipo=gastos${r.id ? `&cat=${r.id}` : ''}`} aria-label={`Ver gastos de ${r.name}: ${fmtEUR(r.cents)}`}>
          <div class="bar-head"><span>{r.name}</span><span class="muted num">{fmtEUR(r.cents)} <span class="chev" aria-hidden="true">›</span></span></div>
          <div class="bar"><div style={{ width: `${Math.max(2, Math.round((r.cents / max) * 100))}%` }} /></div>
        </a>
      ))}
    </section>
  );

  const vsPrev = diff !== null && exp > 0 ? `${diff >= 0 ? '+' : ''}${diff} % vs ${monthLabel(addMonths(month, -1), true)}` : null;

  return (
    <div class="page">
      {/* ---------- Mac ---------- */}
      <div class="desktop-only summary-desktop">
        <div class="header">
          <MonthNav month={month} setMonth={setMonth} />
          <a class="btn" href="#/nuevo"><Icon name="plus" size={18} stroke={2.5} />Añadir movimiento</a>
        </div>
        {notice}
        <div class="kpi-row">
          <div class="kpi-card dark">
            <span>Balance</span>
            <strong class="num">{fmtEUR(bal, { sign: true })}</strong>
          </div>
          <a class="kpi-card link-card" href="#/movimientos?tipo=ingresos">
            <span>Ingresos <span class="chev" aria-hidden="true">›</span></span>
            <strong class="num income">{fmtEUR(inc)}</strong>
          </a>
          <a class="kpi-card link-card" href="#/movimientos?tipo=gastos">
            <span>Gastos <span class="chev" aria-hidden="true">›</span></span>
            <strong class="num">{fmtEUR(exp)}</strong>
            {vsPrev && <small class="muted">{vsPrev}</small>}
          </a>
        </div>
        <div class="cols">
          {categories}
          <section class="card wide">
            <h2 class="card-title">Movimientos <a href="#/movimientos">Ver todos</a></h2>
            {monthTx.length === 0 ? <p class="empty">Aún no hay movimientos en {monthLabel(month).toLowerCase()}</p>
              : <TxTable list={monthTx.slice(0, 12)} cats={cats} />}
          </section>
        </div>
      </div>

      {/* ---------- iPhone ---------- */}
      <div class="mobile-only summary-mobile">
        <MonthNav month={month} setMonth={setMonth} spread />
        {notice}
        <div class="hero">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span class="hero-label">Balance del mes</span>
            <span class="hero-amount num">{fmtEUR(bal, { sign: true })}</span>
          </div>
          <div class="grid-2">
            <a class="hero-box link-card" href="#/movimientos?tipo=ingresos"><span>Ingresos ›</span><strong class="num hero-up">{fmtEUR(inc)}</strong></a>
            <a class="hero-box link-card" href="#/movimientos?tipo=gastos"><span>Gastos ›</span><strong class="num">{fmtEUR(exp)}</strong></a>
          </div>
        </div>
        {categories}
        <section class="card">
          <h2 class="card-title">Últimos movimientos <a href="#/movimientos">Ver todos</a></h2>
          {monthTx.length === 0 && <p class="empty">Aún no hay movimientos en {monthLabel(month).toLowerCase()}</p>}
          <div class="list">
            {monthTx.slice(0, 5).map((x) => <TxRow tx={x} cat={cats[x.category_id]} showDate dateLabel={shortDate(x.date)} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
