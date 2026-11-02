import { useState } from 'preact/hooks';
import { useStore, addTransaction, updateTransaction, deleteTransaction, updateRecurringFrom, toast } from '../store.js';
import { parseAmount, centsToInput, today, norm } from '../lib.js';
import { Segmented, Icon, Dialog } from '../components.jsx';

const goBack = () => (history.length > 1 ? history.back() : (location.hash = '#/'));

export default function Edit({ id, query = {} }) {
  const s = useStore();
  const tx = id ? s.transactions.find((x) => x.id === id) : null;
  const findCat = (name, k) => s.categories.find((c) => c.kind === k && norm(c.name) === norm(name));

  const initKind = tx?.kind || (norm(query.tipo || query.kind).startsWith('ingreso') ? 'ingreso' : 'gasto');
  const [kind, setKind] = useState(initKind);
  const [amount, setAmount] = useState(tx ? centsToInput(tx.amount_cents) : (query.importe || query.amount || '').replace('.', ','));
  const [catId, setCatId] = useState(tx?.category_id || findCat(query.categoria || query.cat || '', initKind)?.id || '');
  const [date, setDate] = useState(tx?.date || today());
  const [concept, setConcept] = useState(tx?.concept || query.concepto || '');
  const [method, setMethod] = useState(tx?.method || (norm(query.cuenta).startsWith('efect') ? 'efectivo' : 'banco'));
  const [fixed, setFixed] = useState(!!(tx?.is_fixed || tx?.recurring_id));
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(null); // 'scope' | 'delete'
  const [err, setErr] = useState('');

  if (id && !tx) return <div class="page"><p class="empty">Este movimiento ya no existe.</p><a class="btn secondary" href="#/movimientos">Volver</a></div>;

  const cats = s.categories.filter((c) => c.kind === kind);
  const cents = parseAmount(amount);
  const data = () => ({ kind, amount_cents: cents, category_id: catId || null, date, concept: concept.trim(), method, is_fixed: tx?.recurring_id ? true : fixed });

  const save = async (scope) => {
    if (!cents || cents <= 0) { setErr('Escribe un importe'); return; }
    if (tx?.recurring_id && !scope) { setAsk('scope'); return; }
    setBusy(true);
    try {
      if (!tx) await addTransaction(data());
      else if (scope === 'following') await updateRecurringFrom(tx, data());
      else await updateTransaction(tx.id, data());
      toast(tx ? 'Cambios guardados' : 'Guardado');
      goBack();
    } catch (e) { setErr(e.message || 'No se pudo guardar'); setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await deleteTransaction(tx.id); toast('Movimiento borrado'); goBack(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <form class="page" style={{ maxWidth: '560px' }} onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div class="header" style={{ flexWrap: 'nowrap' }}>
        <button type="button" class="icon-btn" aria-label="Cerrar" onClick={goBack}><Icon name="close" size={20} /></button>
        <div style={{ flex: 1 }}>
          <Segmented label="Tipo" value={kind} onChange={(v) => { setKind(v); setCatId(''); }} options={[['gasto', 'Gasto'], ['ingreso', 'Ingreso']]} />
        </div>
        {tx && <button type="button" class="icon-btn" aria-label="Borrar movimiento" onClick={() => setAsk('delete')} style={{ color: 'var(--danger)' }}><Icon name="trash" size={20} /></button>}
      </div>

      {tx?.car_log_id && <p class="notice info"><Icon name="car" size={18} />Calculado con los km del coche. Si cambias los km se recalcula.</p>}
      {tx?.recurring_id && <p class="notice info"><Icon name="repeat" size={18} />Gasto fijo: al guardar eliges si cambiar solo este o también los siguientes.</p>}

      <label class="field" style={{ alignItems: 'stretch', padding: '8px 0' }}>
        <span class="sr">Importe</span>
        <div class="amount-wrap">
          <input class={`amount-input num ${kind === 'ingreso' ? 'income' : ''}`} inputMode="decimal" placeholder="0" autoFocus={!tx}
            style={{ width: `${Math.max(1, amount.length) * 0.62 + 0.4}em` }}
            value={amount} onInput={(e) => { setAmount(e.target.value.replace(/[^\d.,]/g, '')); setErr(''); }} aria-label="Importe en euros" />
          <span>€</span>
        </div>
      </label>

      <div class="field">
        <span>Categoría</span>
        <div class="chips">
          {cats.map((c) => <button type="button" class="chip" aria-pressed={catId === c.id} onClick={() => setCatId(c.id)}>{c.name}</button>)}
        </div>
      </div>

      <div class="grid-2">
        <label class="field">Fecha<input class="input" type="date" required value={date} onInput={(e) => setDate(e.target.value)} /></label>
        <div class="field">
          <span>{kind === 'ingreso' ? 'Cobro' : 'Pago'}</span>
          <Segmented label="Cuenta" value={method} onChange={setMethod} options={[['banco', kind === 'ingreso' ? 'Transfer.' : 'Banco'], ['efectivo', 'Efectivo']]} />
        </div>
      </div>

      <label class="field">Concepto<input class="input" placeholder="Opcional" value={concept} onInput={(e) => setConcept(e.target.value)} /></label>

      {kind === 'gasto' && (
        <label class="toggle-row">
          <input type="checkbox" checked={fixed || !!tx?.recurring_id} disabled={!!tx?.recurring_id} onChange={(e) => setFixed(e.target.checked)} />
          <span class="grow"><strong>Gasto fijo</strong>
            <span class="muted">{tx?.recurring_id ? 'Se genera solo cada mes (Ajustes → Gastos fijos)' : 'Cuota, suscripción, préstamo… Sale aparte de los variables'}</span>
          </span>
        </label>
      )}

      {err && <p class="notice" role="alert">{err}</p>}
      <button class="btn big" disabled={busy}>{tx ? 'Guardar cambios' : 'Guardar'}</button>

      {ask === 'scope' && (
        <Dialog title="¿Qué quieres cambiar?" onClose={() => setAsk(null)}>
          <p class="muted" style={{ fontSize: '14px' }}>Este movimiento es un gasto fijo que se repite cada mes.</p>
          <div class="dialog-actions">
            <button type="button" class="btn" onClick={() => { setAsk(null); save('one'); }}>Solo este</button>
            <button type="button" class="btn secondary" onClick={() => { setAsk(null); save('following'); }}>Este y los siguientes</button>
            <button type="button" class="btn ghost" onClick={() => setAsk(null)}>Cancelar</button>
          </div>
        </Dialog>
      )}
      {ask === 'delete' && (
        <Dialog title="¿Borrar este movimiento?" onClose={() => setAsk(null)}>
          <div class="dialog-actions">
            <button type="button" class="btn danger" onClick={remove}>Borrar</button>
            <button type="button" class="btn ghost" onClick={() => setAsk(null)}>Cancelar</button>
          </div>
        </Dialog>
      )}
    </form>
  );
}
