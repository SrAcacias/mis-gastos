import { useStore, categoryMap, monthTotals } from '../store.js';
import { fmtEUR, currentMonth, addMonths, monthLabel, shortDate } from '../lib.js';
import { MonthNav, TxRow, Icon } from '../components.jsx';

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

  const incRows = {};
  for (const x of monthTx) if (x.kind === 'ingreso') incRows[x.category_id || ''] = (incRows[x.category_id || ''] || 0) + x.amount_cents;

  // Aviso de km pendientes
  const cm = currentMonth();
  const pending = s.carLogs.filter((l) => l.month < cm && !l.km_end).sort((a, b) => a.month.localeCompare(b.month));
  const prevMonth = addMonths(cm, -1);
  const missingPrev = s.carLogs.length > 0 && !s.carLogs.some((l) => l.month === prevMonth);

  const diff = prev.exp ? Math.round(((exp - prev.exp) / prev.exp) * 100) : null;

  return (
    <div class="page">
      <div class="header">
        <MonthNav month={month} setMonth={setMonth} />
        <a class="btn desktop-only" href="#/nuevo"><Icon name="plus" size={18} stroke={2.5} />Añadir movimiento</a>
      </div>

      {(pending.length > 0 || missingPrev) && (
        <a class="notice" href="#/coche">
          <Icon name="car" size={20} />
          <span>Faltan los km del coche de {(pending[0]?.month ? monthLabel(pending[0].month) : monthLabel(prevMonth)).toLowerCase()}</span>
        </a>
      )}

      <div class="cols">
        <div class="hero">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span class="hero-label">Balance del mes</span>
            <span class={`hero-amount num ${bal > 0 ? 'hero-up' : ''}`}>{fmtEUR(bal, { sign: true })}</span>
          </div>
          <div class="grid-2">
            <div class="hero-box"><span>Ingresos</span><strong class="num hero-up">{fmtEUR(inc)}</strong></div>
            <div class="hero-box"><span>Gastos</span><strong class="num">{fmtEUR(exp)}</strong></div>
          </div>
          {diff !== null && exp > 0 && (
            <span class="hero-label">Gastos {diff >= 0 ? `+${diff}` : diff} % respecto a {monthLabel(addMonths(month, -1)).toLowerCase()}</span>
          )}
        </div>

        <section class="card">
          <h2 class="card-title">Gastos por categoría</h2>
          {rows.length === 0 && <p class="empty">Sin gastos este mes</p>}
          {rows.map((r) => (
            <div class="bar-row">
              <div class="bar-head"><span>{r.name}</span><span class="muted num">{fmtEUR(r.cents)}</span></div>
              <div class="bar"><div style={{ width: `${Math.max(2, Math.round((r.cents / max) * 100))}%` }} /></div>
            </div>
          ))}
          {Object.keys(incRows).length > 0 && (
            <>
              <h2 class="card-title" style={{ marginTop: '6px' }}>Ingresos</h2>
              {Object.entries(incRows).map(([id, c]) => (
                <div class="bar-head"><span>{cats[id]?.name || 'Sin categoría'}</span><span class="income num" style={{ fontWeight: 700 }}>{fmtEUR(c)}</span></div>
              ))}
            </>
          )}
        </section>

        <section class="card">
          <h2 class="card-title">Últimos movimientos <a href="#/movimientos">Ver todos</a></h2>
          {monthTx.length === 0 && <p class="empty">Aún no hay movimientos en {monthLabel(month).toLowerCase()}</p>}
          <div class="list">
            {monthTx.slice(0, 6).map((x) => <TxRow tx={x} cat={cats[x.category_id]} showDate dateLabel={shortDate(x.date)} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
