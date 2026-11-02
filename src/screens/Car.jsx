import { useState } from 'preact/hooks';
import { useStore, saveCarLog, deleteCarLog, updateSettings, toast } from '../store.js';
import { fmtEUR, currentMonth, addMonths, monthLabel, fuelCost } from '../lib.js';
import { Icon, Dialog } from '../components.jsx';

const toNum = (v) => { const n = Number(String(v).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) && String(v).trim() !== '' ? n : null; };
const toDec = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && String(v).trim() !== '' ? n : null; };
const fmtDec = (n, d = 2) => (n == null ? '' : String(Number(n).toFixed(d)).replace('.', ',').replace(/,?0+$/, ''));

export default function Car() {
  const s = useStore();
  const cm = currentMonth();
  const logs = s.carLogs;
  const pending = logs.filter((l) => !l.km_end).sort((a, b) => a.month.localeCompare(b.month))[0];
  const defaultMonth = pending?.month || (logs.some((l) => l.month === addMonths(cm, -1)) ? cm : addMonths(cm, -1));

  const [month, setMonth] = useState(defaultMonth);
  const formFor = (m) => {
    const log = logs.find((l) => l.month === m);
    const prev = logs.find((l) => l.month === addMonths(m, -1));
    const lastPrice = logs.find((l) => l.price_per_l)?.price_per_l;
    return {
      km_start: String(log?.km_start ?? prev?.km_end ?? ''),
      km_end: String(log?.km_end ?? ''),
      price: fmtDec(log?.price_per_l ?? lastPrice, 3),
      kmpl: fmtDec(log?.km_per_l ?? s.settings.km_per_l)
    };
  };
  const [f, setF] = useState(formFor(defaultMonth));
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(null);
  const [kmpl, setKmpl] = useState(fmtDec(s.settings.km_per_l));

  const pick = (m) => { setMonth(m); setF(formFor(m)); window.scrollTo(0, 0); };
  const calc = fuelCost({ km_start: toNum(f.km_start), km_end: toNum(f.km_end), price_per_l: toDec(f.price), km_per_l: toDec(f.kmpl) });

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await saveCarLog({ month, km_start: toNum(f.km_start), km_end: toNum(f.km_end), price_per_l: toDec(f.price), km_per_l: toDec(f.kmpl) });
      toast(calc.cents ? `Gasolina de ${monthLabel(month).toLowerCase()}: ${fmtEUR(calc.cents)}` : 'Kilómetros guardados');
    } catch (err) { toast(err.message || 'No se pudo guardar'); }
    setBusy(false);
  };

  const options = [];
  for (let m = addMonths(cm, -24); m <= cm; m = addMonths(m, 1)) options.push(m);

  return (
    <div class="page" style={{ maxWidth: '760px' }}>
      <div class="header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span class="eyebrow">Gasolina según kilómetros</span>
          <h1 class="title">Coche</h1>
        </div>
      </div>

      <form class="card" onSubmit={save}>
        <label class="field">Mes
          <select class="select" value={month} onChange={(e) => pick(e.target.value)}>
            {options.slice().reverse().map((m) => <option value={m}>{monthLabel(m)}{logs.some((l) => l.month === m && l.km_end) ? ' ✓' : ''}</option>)}
          </select>
        </label>
        <div class="grid-2">
          <label class="field">Km al inicio<input class="input num" inputMode="numeric" value={f.km_start} onInput={(e) => setF({ ...f, km_start: e.target.value })} /></label>
          <label class="field">Km a final de mes<input class="input num" inputMode="numeric" placeholder="Cuentakilómetros" value={f.km_end} onInput={(e) => setF({ ...f, km_end: e.target.value })} /></label>
          <label class="field">Precio gasolina (€/L)<input class="input num" inputMode="decimal" value={f.price} onInput={(e) => setF({ ...f, price: e.target.value })} /></label>
          <label class="field">Consumo (km por litro)<input class="input num" inputMode="decimal" value={f.kmpl} onInput={(e) => setF({ ...f, kmpl: e.target.value })} /></label>
        </div>
        <div class="kpis">
          <div class="kpi" style={{ background: 'var(--surface-2)' }}><span>Km hechos</span><strong class="num">{calc.km.toLocaleString('es-ES')}</strong></div>
          <div class="kpi" style={{ background: 'var(--surface-2)' }}><span>Litros</span><strong class="num">{fmtDec(calc.litres, 1) || '0'}</strong></div>
          <div class="kpi" style={{ background: 'var(--surface-2)' }}><span>Gasto gasolina</span><strong class="num">{fmtEUR(calc.cents)}</strong></div>
        </div>
        <button class="btn big" disabled={busy}>Guardar {monthLabel(month).toLowerCase()}</button>
        <p class="muted" style={{ fontSize: '13px' }}>Se crea (o actualiza) el gasto "Gasolina" en Coche el último día del mes. Los km de final pasan a ser los de inicio del mes siguiente.</p>
      </form>

      <section class="card">
        <h2 class="card-title">Historial</h2>
        {logs.length === 0 && <p class="empty">Todavía no hay registros</p>}
        <div class="scroll-x">
          <table class="tbl num">
            <thead><tr><th>Mes</th><th class="r">Km</th><th class="r">€/L</th><th class="r">Gasto</th><th><span class="sr">Acciones</span></th></tr></thead>
            <tbody>
              {logs.map((l) => {
                const c = fuelCost(l);
                return (
                  <tr>
                    <td>{monthLabel(l.month)}</td>
                    <td class="r">{l.km_end ? c.km.toLocaleString('es-ES') : <span class="muted">pendiente</span>}</td>
                    <td class="r">{l.price_per_l ? fmtDec(l.price_per_l, 3) : '—'}</td>
                    <td class="r" style={{ fontWeight: 700 }}>{c.cents ? fmtEUR(c.cents) : '—'}</td>
                    <td class="r" style={{ whiteSpace: 'nowrap' }}>
                      <button class="icon-btn ghost" aria-label={`Editar ${monthLabel(l.month)}`} onClick={() => pick(l.month)}><Icon name="edit" size={18} /></button>
                      <button class="icon-btn ghost" aria-label={`Borrar ${monthLabel(l.month)}`} onClick={() => setDel(l)} style={{ color: 'var(--danger)' }}><Icon name="trash" size={18} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <form class="card" onSubmit={async (e) => { e.preventDefault(); const v = toDec(kmpl); if (v > 0) { await updateSettings({ km_per_l: v }); toast('Consumo por defecto guardado'); } }}>
        <h2 class="card-title">Consumo por defecto</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <label class="field" style={{ flex: 1 }}>Km por litro (16,67 km/L = 6 L/100 km)<input class="input num" inputMode="decimal" value={kmpl} onInput={(e) => setKmpl(e.target.value)} /></label>
          <button class="btn secondary">Guardar</button>
        </div>
      </form>

      {del && (
        <Dialog title={`¿Borrar ${monthLabel(del.month).toLowerCase()}?`} onClose={() => setDel(null)}>
          <p class="muted" style={{ fontSize: '14px' }}>También se borra su gasto de gasolina.</p>
          <div class="dialog-actions">
            <button class="btn danger" onClick={async () => { await deleteCarLog(del.id); setDel(null); toast('Registro borrado'); }}>Borrar</button>
            <button class="btn ghost" onClick={() => setDel(null)}>Cancelar</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
