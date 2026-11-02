import { useState } from 'preact/hooks';
import { useStore } from '../store.js';
import { fmtEUR, currentMonth, addMonths, monthLabel } from '../lib.js';

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
          <h1 class="title">Gráfico</h1>
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
