import { useState } from 'preact/hooks';
import { useStore } from '../store.js';
import { fmtEUR, currentMonth, addMonths, monthLabel } from '../lib.js';
import { Segmented } from '../components.jsx';

const GASTO = 'color-mix(in srgb, var(--ink) 28%, var(--surface))';

export default function Chart() {
  const s = useStore();
  const cm = currentMonth();
  const first = s.transactions.length ? s.transactions[s.transactions.length - 1].date.slice(0, 7) : cm;
  const allMonths = [];
  for (let m = first < cm ? first : cm; m <= cm; m = addMonths(m, 1)) allMonths.push(m);

  const defFrom = allMonths[Math.max(0, allMonths.length - 12)];
  const [from, setFrom] = useState(defFrom);
  const [to, setTo] = useState(cm);
  const [show, setShow] = useState({ inc: true, exp: true, bal: true });
  const [view, setView] = useState('general');

  const months = allMonths.filter((m) => m >= from && m <= to);
  const data = months.map((m) => {
    let inc = 0, exp = 0;
    for (const x of s.transactions) if (x.date.startsWith(m)) { if (x.kind === 'ingreso') inc += x.amount_cents; else exp += x.amount_cents; }
    return { m, inc, exp, bal: inc - exp };
  });
  const tot = data.reduce((a, d) => ({ inc: a.inc + d.inc, exp: a.exp + d.exp }), { inc: 0, exp: 0 });
  const withInc = data.filter((d) => d.inc > 0).length || 1;

  // Escalas
  const vals = data.flatMap((d) => [show.inc ? d.inc : 0, show.exp ? d.exp : 0, show.bal ? d.bal : 0]);
  const maxV = Math.max(1, ...vals);
  const minV = Math.min(0, ...vals);
  const W = Math.max(640, months.length * 64), H = 300, padL = 64, padR = 12, padT = 16, padB = 34;
  const iw = W - padL - padR, ih = H - padT - padB;
  const y = (v) => padT + ((maxV - v) / (maxV - minV)) * ih;
  const step = iw / Math.max(1, months.length);
  const nBars = (show.inc ? 1 : 0) + (show.exp ? 1 : 0);
  const bw = Math.min(22, (step * 0.7) / Math.max(1, nBars));
  const ticks = niceTicks(minV, maxV);

  const toggle = (k) => setShow({ ...show, [k]: !show[k] });

  return (
    <div class="page">
      <div class="header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span class="eyebrow">{monthLabel(from)} – {monthLabel(to)}</span>
          <h1 class="title">Balance</h1>
        </div>
      </div>

      <div class="grid-2">
        <label class="field">Desde
          <select class="select" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }}>
            {allMonths.map((m) => <option value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
        <label class="field">Hasta
          <select class="select" value={to} onChange={(e) => { setTo(e.target.value); if (e.target.value < from) setFrom(e.target.value); }}>
            {allMonths.map((m) => <option value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
      </div>

      <Segmented label="Vista" value={view} onChange={setView} options={[['general', 'General'], ['categorias', 'Por categoría']]} />

      {view === 'categorias' ? <ByCategory months={months} /> : (<>
      <div class="kpis">
        <div class="kpi"><span>Ingresos</span><strong class="num income">{fmtEUR(tot.inc)}</strong></div>
        <div class="kpi"><span>Gastos</span><strong class="num">{fmtEUR(tot.exp)}</strong></div>
        <div class="kpi"><span>Balance</span><strong class="num">{fmtEUR(tot.inc - tot.exp, { sign: true })}</strong></div>
        <div class="kpi"><span>Ingreso medio / mes</span><strong class="num">{fmtEUR(Math.round(tot.inc / withInc))}</strong></div>
      </div>

      <section class="card">
        <div class="chart-legend" role="group" aria-label="Series">
          {[['inc', 'Ingresos', 'var(--accent)'], ['exp', 'Gastos', GASTO], ['bal', 'Balance', 'var(--ink)']].map(([k, l, c]) => (
            <button type="button" class="chip legend" aria-pressed={show[k]} onClick={() => toggle(k)} style={{ minWidth: '110px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span class="color-dot" style={{ background: c, border: '2px solid var(--surface)' }} />{l}
              </span>
            </button>
          ))}
        </div>
        <div class="scroll-x">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: `${Math.min(W, 640)}px`, display: 'block' }} role="img" aria-label={`Ingresos, gastos y balance de ${monthLabel(from)} a ${monthLabel(to)}`}>
            {ticks.map((t) => (
              <g>
                <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} style={{ stroke: t === 0 ? 'var(--muted)' : 'var(--line)' }} stroke-width={t === 0 ? 1.2 : 1} />
                <text x={padL - 8} y={y(t) + 4} text-anchor="end" font-size="11" style={{ fill: 'var(--muted)' }}>{shortEUR(t)}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = padL + step * i + step / 2;
              let x0 = cx - (bw * nBars) / 2;
              const bars = [];
              if (show.inc) { bars.push(<rect x={x0} y={y(d.inc)} width={bw - 2} height={Math.max(0, y(0) - y(d.inc))} rx="3" style={{ fill: 'var(--accent)' }}><title>{`${monthLabel(d.m)} · Ingresos ${fmtEUR(d.inc)}`}</title></rect>); x0 += bw; }
              if (show.exp) { bars.push(<rect x={x0} y={y(d.exp)} width={bw - 2} height={Math.max(0, y(0) - y(d.exp))} rx="3" style={{ fill: GASTO }}><title>{`${monthLabel(d.m)} · Gastos ${fmtEUR(d.exp)}`}</title></rect>); }
              return (
                <g>
                  {bars}
                  <text x={cx} y={H - 12} text-anchor="middle" font-size="11" font-weight="600" style={{ fill: 'var(--muted)' }}>{monthLabel(d.m, true)}</text>
                </g>
              );
            })}
            {show.bal && data.length > 0 && (
              <g>
                <polyline fill="none" stroke-width="2.5" stroke-linejoin="round" style={{ stroke: 'var(--ink)' }}
                  points={data.map((d, i) => `${padL + step * i + step / 2},${y(d.bal)}`).join(' ')} />
                {data.map((d, i) => (
                  <circle cx={padL + step * i + step / 2} cy={y(d.bal)} r="4" style={{ fill: 'var(--surface)', stroke: 'var(--ink)' }} stroke-width="2">
                    <title>{`${monthLabel(d.m)} · Balance ${fmtEUR(d.bal, { sign: true })}`}</title>
                  </circle>
                ))}
              </g>
            )}
          </svg>
        </div>
      </section>

      <section class="card">
        <h2 class="card-title">Por mes</h2>
        <div class="scroll-x">
          <table class="tbl num">
            <thead><tr><th>Mes</th><th class="r">Ingresos</th><th class="r">Gastos</th><th class="r">Balance</th></tr></thead>
            <tbody>
              {data.slice().reverse().map((d) => (
                <tr>
                  <td>{monthLabel(d.m)}</td>
                  <td class="r income">{fmtEUR(d.inc)}</td>
                  <td class="r">{fmtEUR(d.exp)}</td>
                  <td class="r" style={{ fontWeight: 700 }}>{fmtEUR(d.bal, { sign: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </>)}
    </div>
  );
}

function niceTicks(min, max) {
  const range = max - min || 1;
  const raw = range / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) || raw;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-6; v += step) out.push(Math.round(v));
  if (!out.includes(0)) out.push(0);
  return out;
}
function shortEUR(c) {
  const e = c / 100;
  if (Math.abs(e) >= 1000) return `${(e / 1000).toFixed(Math.abs(e) >= 10000 ? 0 : 1).replace('.', ',')}k €`;
  return `${Math.round(e)} €`;
}

// ---------- Evolución mensual por categoría ----------
function ByCategory({ months }) {
  const s = useStore();
  const inRange = s.transactions.filter((x) => months.length && x.date.slice(0, 7) >= months[0] && x.date.slice(0, 7) <= months[months.length - 1]);
  const totals = {};
  for (const x of inRange) totals[x.category_id || ''] = (totals[x.category_id || ''] || 0) + x.amount_cents;
  const gastos = s.categories.filter((c) => c.kind === 'gasto').sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0));
  const ingresos = s.categories.filter((c) => c.kind === 'ingreso');
  const [catId, setCatId] = useState(gastos[0]?.id || '');
  const cat = s.categories.find((c) => c.id === catId);

  const per = (id) => months.map((m) => inRange.filter((x) => x.category_id === id && x.date.startsWith(m)).reduce((a, x) => a + x.amount_cents, 0));
  const data = per(catId);
  const total = data.reduce((a, b) => a + b, 0);
  const withData = data.filter((v) => v > 0).length || 1;
  const maxI = data.indexOf(Math.max(...data));

  const maxV = Math.max(1, ...data);
  const W = Math.max(640, months.length * 64), H = 260, padL = 64, padR = 12, padT = 24, padB = 34;
  const iw = W - padL - padR, ih = H - padT - padB;
  const y = (v) => padT + ((maxV - v) / maxV) * ih;
  const step = iw / Math.max(1, months.length);
  const bw = Math.min(36, step * 0.6);
  const ticks = niceTicks(0, maxV);
  const avg = Math.round(total / months.length || 0);
  const color = cat?.kind === 'ingreso' ? 'var(--accent)' : 'var(--accent)';

  const matrix = gastos.filter((c) => totals[c.id]).map((c) => ({ c, vals: per(c.id) }));

  return (
    <>
      <label class="field">Categoría
        <select class="select" value={catId} onChange={(e) => setCatId(e.target.value)}>
          <optgroup label="Gastos">{gastos.map((c) => <option value={c.id}>{c.name}</option>)}</optgroup>
          <optgroup label="Ingresos">{ingresos.map((c) => <option value={c.id}>{c.name}</option>)}</optgroup>
        </select>
      </label>

      <div class="kpis">
        <div class="kpi"><span>Total {cat?.name?.toLowerCase()}</span><strong class="num">{fmtEUR(total)}</strong></div>
        <div class="kpi"><span>Media / mes</span><strong class="num">{fmtEUR(avg)}</strong></div>
        <div class="kpi"><span>Mes con más</span><strong class="num">{total ? `${monthLabel(months[maxI], true)} · ${fmtEUR(data[maxI])}` : '—'}</strong></div>
      </div>

      <section class="card">
        <h2 class="card-title">{cat?.name} por mes</h2>
        <div class="scroll-x">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: `${Math.min(W, 640)}px`, display: 'block' }} role="img" aria-label={`${cat?.name} por mes`}>
            {ticks.map((t) => (
              <g>
                <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} style={{ stroke: t === 0 ? 'var(--muted)' : 'var(--line)' }} stroke-width="1" />
                <text x={padL - 8} y={y(t) + 4} text-anchor="end" font-size="11" style={{ fill: 'var(--muted)' }}>{shortEUR(t)}</text>
              </g>
            ))}
            {avg > 0 && <g>
              <line x1={padL} x2={W - padR} y1={y(avg)} y2={y(avg)} stroke-dasharray="5 5" stroke-width="1.5" style={{ stroke: 'var(--ink)' }} />
              <text x={W - padR} y={y(avg) - 6} text-anchor="end" font-size="11" font-weight="700" style={{ fill: 'var(--ink)' }}>media {shortEUR(avg)}</text>
            </g>}
            {data.map((v, i) => {
              const cx = padL + step * i + step / 2;
              return (
                <g>
                  <rect x={cx - bw / 2} y={y(v)} width={bw} height={Math.max(0, y(0) - y(v))} rx="4" style={{ fill: color }}><title>{`${monthLabel(months[i])} · ${fmtEUR(v)}`}</title></rect>
                  {v > 0 && <text x={cx} y={y(v) - 6} text-anchor="middle" font-size="10" font-weight="700" style={{ fill: 'var(--ink)' }}>{shortEUR(v)}</text>}
                  <text x={cx} y={H - 12} text-anchor="middle" font-size="11" font-weight="600" style={{ fill: 'var(--muted)' }}>{monthLabel(months[i], true)}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      <section class="card">
        <h2 class="card-title">Gastos por categoría y mes</h2>
        <div class="scroll-x">
          <table class="tbl num matrix">
            <thead><tr><th>Categoría</th>{months.map((m) => <th class="r">{monthLabel(m, true)}</th>)}<th class="r">Total</th></tr></thead>
            <tbody>
              {matrix.map(({ c, vals }) => (
                <tr class={c.id === catId ? 'sel' : ''} onClick={() => setCatId(c.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{c.name}</td>
                  {vals.map((v) => <td class="r">{v ? fmtEUR(v).replace(' €', '') : <span class="muted">—</span>}</td>)}
                  <td class="r" style={{ fontWeight: 800 }}>{fmtEUR(vals.reduce((a, b) => a + b, 0)).replace(' €', '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p class="muted" style={{ fontSize: '12px' }}>Importes en euros. Pulsa una fila para verla en el gráfico.</p>
      </section>
    </>
  );
}
