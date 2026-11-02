import { useState } from 'preact/hooks';
import {
  useStore, updateSettings, THEMES, saveCategory, deleteCategory, saveRule, deleteRule,
  createShortcutToken, exportCSV, importRows, signOut, isLocal, toast
} from '../store.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { fmtEUR, parseAmount, centsToInput, parseCSV, downloadFile, today, shortDate } from '../lib.js';
import { Segmented, Icon, Dialog } from '../components.jsx';

const PALETTE = ['#C2410C', '#B45309', '#15803D', '#0F766E', '#0E7490', '#1D4ED8', '#6D28D9', '#7C3AED', '#BE185D', '#374151', '#6B7280'];

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copiado'); } catch { toast('No se pudo copiar'); }
}

export default function Settings() {
  const s = useStore();
  const [catEdit, setCatEdit] = useState(null);
  const [ruleEdit, setRuleEdit] = useState(null);

  return (
    <div class="page" style={{ maxWidth: '760px' }}>
      <h1 class="title">Ajustes</h1>

      {/* Apariencia */}
      <section class="card">
        <h2 class="card-title">Apariencia</h2>
        <div class="swatches" role="group" aria-label="Color">
          {Object.entries(THEMES).map(([k, t]) => (
            <button type="button" class="swatch" aria-pressed={s.settings.theme === k} aria-label={t.name} title={t.name}
              style={{ background: t.light }} onClick={() => updateSettings({ theme: k })}>
              {s.settings.theme === k && <Icon name="check" size={20} stroke={3} />}
            </button>
          ))}
        </div>
        <span class="muted" style={{ fontSize: '13px', fontWeight: 600 }}>{THEMES[s.settings.theme]?.name}</span>
        <Segmented label="Modo" value={s.settings.mode} onChange={(v) => updateSettings({ mode: v })} options={[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']]} />
      </section>

      {/* Coche */}
      <a class="card" href="#/coche" style={{ textDecoration: 'none', color: 'inherit', flexDirection: 'row', alignItems: 'center' }}>
        <Icon name="car" />
        <span style={{ flex: 1, fontWeight: 700 }}>Coche y gasolina</span>
        <Icon name="right" size={18} />
      </a>

      {/* Categorías */}
      <section class="card">
        <h2 class="card-title">Categorías</h2>
        {[['gasto', 'Gastos'], ['ingreso', 'Ingresos']].map(([k, label]) => (
          <div>
            <div class="bar-head" style={{ marginBottom: '4px' }}>
              <span class="muted" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '12px', letterSpacing: '.04em' }}>{label}</span>
              <button class="btn ghost" onClick={() => setCatEdit({ name: '', kind: k, color: PALETTE[0] })}><Icon name="plus" size={16} />Añadir</button>
            </div>
            {s.categories.filter((c) => c.kind === k).map((c) => {
              const n = s.transactions.filter((x) => x.category_id === c.id).length;
              return (
                <div class="settings-row">
                  <span class="color-dot" style={{ background: c.color }} />
                  <span class="grow" style={{ fontWeight: 600 }}>{c.name}</span>
                  <span class="muted" style={{ fontSize: '12px' }}>{n} mov.</span>
                  <button class="icon-btn ghost" aria-label={`Editar ${c.name}`} onClick={() => setCatEdit(c)}><Icon name="edit" size={18} /></button>
                </div>
              );
            })}
          </div>
        ))}
      </section>

      {/* Gastos fijos */}
      <section class="card">
        <h2 class="card-title">Gastos e ingresos fijos
          <button class="btn ghost" onClick={() => setRuleEdit({ concept: '', kind: 'gasto', amount_cents: 0, category_id: '', method: 'banco', frequency: 'monthly', next_date: today(), active: true })}><Icon name="plus" size={16} />Añadir</button>
        </h2>
        {s.rules.length === 0 && <p class="empty">No hay fijos</p>}
        {s.rules.slice().sort((a, b) => b.amount_cents - a.amount_cents).map((r) => (
          <div class="settings-row" style={{ opacity: r.active ? 1 : 0.55 }}>
            <Icon name="repeat" size={18} />
            <div class="grow">
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{r.concept}</div>
              <div class="muted" style={{ fontSize: '12px' }}>
                {r.active ? `Próximo: ${shortDate(r.next_date)} · ${r.frequency === 'yearly' ? 'anual' : 'mensual'}` : 'Pausado'}
              </div>
            </div>
            <span class={`num ${r.kind === 'ingreso' ? 'income' : ''}`} style={{ fontWeight: 700, fontSize: '14px' }}>{fmtEUR(r.amount_cents)}</span>
            <button class="icon-btn ghost" aria-label={`Editar ${r.concept}`} onClick={() => setRuleEdit(r)}><Icon name="edit" size={18} /></button>
          </div>
        ))}
      </section>

      <Shortcut />
      <DataSection />

      {/* Cuenta */}
      <section class="card">
        <h2 class="card-title">Cuenta</h2>
        <p class="muted" style={{ fontSize: '14px' }}>{isLocal ? 'Modo local: los datos solo se guardan en este navegador. Configura Supabase para sincronizar Mac e iPhone.' : s.user?.email}</p>
        {!isLocal && <button class="btn secondary" onClick={signOut}>Cerrar sesión</button>}
      </section>

      {catEdit && <CategoryDialog cat={catEdit} onClose={() => setCatEdit(null)} />}
      {ruleEdit && <RuleDialog rule={ruleEdit} onClose={() => setRuleEdit(null)} />}
    </div>
  );
}

function CategoryDialog({ cat, onClose }) {
  const s = useStore();
  const [name, setName] = useState(cat.name);
  const [color, setColor] = useState(cat.color);
  const [confirmDel, setConfirmDel] = useState(false);
  const others = s.categories.filter((c) => c.kind === cat.kind && c.id !== cat.id);
  const [target, setTarget] = useState(others.find((c) => /^otros/i.test(c.name))?.id || others[0]?.id || '');
  const used = cat.id ? s.transactions.filter((x) => x.category_id === cat.id).length : 0;

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await saveCategory({ ...(cat.id ? { id: cat.id } : { kind: cat.kind }), name: name.trim(), color });
    toast('Categoría guardada'); onClose();
  };
  if (confirmDel) {
    return (
      <Dialog title={`Borrar "${cat.name}"`} onClose={onClose}>
        {used > 0 ? (
          <label class="field">Pasar sus {used} movimientos a
            <select class="select" value={target} onChange={(e) => setTarget(e.target.value)}>
              {others.map((c) => <option value={c.id}>{c.name}</option>)}
              <option value="">Sin categoría</option>
            </select>
          </label>
        ) : <p class="muted" style={{ fontSize: '14px' }}>No tiene movimientos.</p>}
        <div class="dialog-actions">
          <button class="btn danger" onClick={async () => { await deleteCategory(cat.id, target); toast('Categoría borrada'); onClose(); }}>Borrar categoría</button>
          <button class="btn ghost" onClick={onClose}>Cancelar</button>
        </div>
      </Dialog>
    );
  }
  return (
    <Dialog title={cat.id ? 'Editar categoría' : `Nueva categoría de ${cat.kind}`} onClose={onClose}>
      <form style={{ display: 'flex', flexDirection: 'column', gap: '14px' }} onSubmit={save}>
        <label class="field">Nombre<input class="input" required value={name} onInput={(e) => setName(e.target.value)} /></label>
        <div class="field"><span>Color</span>
          <div class="swatches">
            {PALETTE.map((c) => (
              <button type="button" class="swatch" style={{ background: c, width: '36px', height: '36px' }} aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => setColor(c)}>
                {color === c && <Icon name="check" size={16} stroke={3} />}
              </button>
            ))}
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn">Guardar</button>
          {cat.id && <button type="button" class="btn danger" onClick={() => setConfirmDel(true)}>Borrar categoría</button>}
          <button type="button" class="btn ghost" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </Dialog>
  );
}

function RuleDialog({ rule, onClose }) {
  const s = useStore();
  const [r, setR] = useState({ ...rule, amount: centsToInput(rule.amount_cents) });
  const [confirmDel, setConfirmDel] = useState(false);
  const up = (k) => (e) => setR({ ...r, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const amount_cents = parseAmount(r.amount);
    if (!r.concept.trim() || amount_cents <= 0) { toast('Falta el concepto o el importe'); return; }
    const { amount, created_at, user_id, ...rest } = r;
    await saveRule({ ...rest, concept: r.concept.trim(), amount_cents, category_id: r.category_id || null });
    toast('Fijo guardado'); onClose();
  };
  if (confirmDel) {
    return (
      <Dialog title={`¿Borrar "${rule.concept}"?`} onClose={onClose}>
        <p class="muted" style={{ fontSize: '14px' }}>Los movimientos que ya se crearon se mantienen.</p>
        <div class="dialog-actions">
          <button class="btn danger" onClick={async () => { await deleteRule(rule.id); toast('Fijo borrado'); onClose(); }}>Borrar</button>
          <button class="btn ghost" onClick={onClose}>Cancelar</button>
        </div>
      </Dialog>
    );
  }
  return (
    <Dialog title={rule.id ? 'Editar fijo' : 'Nuevo fijo'} onClose={onClose}>
      <form style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} onSubmit={save}>
        <Segmented label="Tipo" value={r.kind} onChange={(v) => setR({ ...r, kind: v, category_id: '' })} options={[['gasto', 'Gasto'], ['ingreso', 'Ingreso']]} />
        <label class="field">Concepto<input class="input" required value={r.concept} onInput={up('concept')} /></label>
        <div class="grid-2">
          <label class="field">Importe (€)<input class="input num" inputMode="decimal" required value={r.amount} onInput={up('amount')} /></label>
          <label class="field">Próxima fecha<input class="input" type="date" required value={r.next_date} onInput={up('next_date')} /></label>
        </div>
        <label class="field">Categoría
          <select class="select" value={r.category_id || ''} onChange={up('category_id')}>
            <option value="">Sin categoría</option>
            {s.categories.filter((c) => c.kind === r.kind).map((c) => <option value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div class="grid-2">
          <Segmented label="Frecuencia" value={r.frequency} onChange={(v) => setR({ ...r, frequency: v })} options={[['monthly', 'Mensual'], ['yearly', 'Anual']]} />
          <Segmented label="Cuenta" value={r.method} onChange={(v) => setR({ ...r, method: v })} options={[['banco', 'Banco'], ['efectivo', 'Efectivo']]} />
        </div>
        <label class="settings-row" style={{ borderBottom: 'none', cursor: 'pointer' }}>
          <input type="checkbox" checked={r.active} onChange={(e) => setR({ ...r, active: e.target.checked })} style={{ width: '20px', height: '20px' }} />
          <span class="grow" style={{ fontWeight: 600 }}>Activo (se crea automáticamente cada vez)</span>
        </label>
        <p class="muted" style={{ fontSize: '12px' }}>Cambiar aquí no modifica los movimientos ya creados. Para cambiar uno ya creado, edítalo en Movimientos.</p>
        <div class="dialog-actions">
          <button class="btn">Guardar</button>
          {rule.id && <button type="button" class="btn danger" onClick={() => setConfirmDel(true)}>Borrar fijo</button>}
          <button type="button" class="btn ghost" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </Dialog>
  );
}

function Shortcut() {
  const s = useStore();
  const token = s.settings.shortcut_token;
  const url = `${SUPABASE_URL}/rest/v1/rpc/quick_add`;
  const cats = s.categories.filter((c) => c.kind === 'gasto').map((c) => c.name);
  return (
    <section class="card">
      <h2 class="card-title">Atajo de Siri</h2>
      {isLocal ? (
        <p class="muted" style={{ fontSize: '14px' }}>Disponible cuando conectes Supabase.</p>
      ) : !token ? (
        <>
          <p class="muted" style={{ fontSize: '14px' }}>Crea una clave privada para que el atajo pueda guardar gastos sin abrir la app.</p>
          <button class="btn" onClick={createShortcutToken}>Crear clave del atajo</button>
        </>
      ) : (
        <>
          <p style={{ fontSize: '14px' }}>En la app <strong>Atajos</strong> del iPhone, crea un atajo llamado <strong>"Añadir gasto"</strong> con estas acciones:</p>
          <ol class="steps">
            <li><strong>Pedir entrada</strong> → Número. Pregunta: "¿Cuánto?"</li>
            <li><strong>Elegir de la lista</strong> con: {cats.join(', ')}</li>
            <li><strong>Pedir entrada</strong> → Texto. Pregunta: "¿Concepto?" (opcional)</li>
            <li><strong>Obtener contenido de URL</strong>:
              <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span>URL: <code>{url}</code> <button class="btn ghost" onClick={() => copy(url)}>Copiar</button></span>
                <span>Método: <code>POST</code></span>
                <span>Cabeceras: <code>apikey</code> = la clave pública <button class="btn ghost" onClick={() => copy(SUPABASE_ANON_KEY)}>Copiar</button> · <code>Content-Type</code> = <code>application/json</code></span>
                <span>Cuerpo JSON: <code>p_token</code> (texto) = tu clave <button class="btn ghost" onClick={() => copy(token)}>Copiar</button>, <code>p_amount</code> (número) = Entrada proporcionada, <code>p_category</code> (texto) = Elemento elegido, <code>p_concept</code> (texto) = Texto del paso 3</span>
              </div>
            </li>
            <li><strong>Mostrar resultado</strong> → Contenido de la URL (Siri dirá "Guardado: … €").</li>
          </ol>
          <p class="muted" style={{ fontSize: '12px' }}>Opcional: añade <code>p_method</code> = "efectivo" para pagos en efectivo. Asigna el atajo al botón de Acción del iPhone para tenerlo a un toque.</p>
          <button class="btn secondary" onClick={() => createShortcutToken().then(() => toast('Nueva clave creada: actualízala en el atajo'))}>Cambiar clave</button>
        </>
      )}
    </section>
  );
}

function DataSection() {
  const s = useStore();
  const y = new Date().getFullYear();
  const [range, setRange] = useState('all');
  const [from, setFrom] = useState(`${y}-01-01`);
  const [to, setTo] = useState(today());
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const rows = parseCSV(await file.text());
      const r = await importRows(rows);
      toast(`Importados ${r.added}${r.skipped ? ` · ${r.skipped} repetidos` : ''}${r.invalid ? ` · ${r.invalid} sin fecha o importe` : ''}`);
    } catch (err) { toast(err.message || 'Error al importar'); }
    setBusy(false);
  };
  const doExport = () => {
    const opts = range === 'all' ? {} : range === 'year' ? { from: `${y}-01-01`, to: `${y}-12-31` } : { from, to };
    const name = range === 'all' ? 'movimientos.csv' : `movimientos_${opts.from}_${opts.to}.csv`;
    downloadFile(name, exportCSV(opts));
  };

  return (
    <section class="card">
      <h2 class="card-title">Importar y exportar</h2>
      <p class="muted" style={{ fontSize: '13px' }}>{s.transactions.length} movimientos guardados. CSV con columnas fecha;tipo;concepto;categoria;importe;cuenta. Los repetidos se saltan.</p>
      <label class="btn secondary" style={{ cursor: 'pointer' }}>
        <Icon name="upload" size={18} />{busy ? 'Importando…' : 'Importar CSV'}
        <input type="file" accept=".csv,text/csv" class="sr" onChange={onFile} disabled={busy} />
      </label>
      <Segmented label="Rango a exportar" value={range} onChange={setRange} options={[['all', 'Todo'], ['year', String(y)], ['custom', 'Fechas']]} />
      {range === 'custom' && (
        <div class="grid-2">
          <label class="field">Desde<input class="input" type="date" value={from} onInput={(e) => setFrom(e.target.value)} /></label>
          <label class="field">Hasta<input class="input" type="date" value={to} onInput={(e) => setTo(e.target.value)} /></label>
        </div>
      )}
      <button class="btn" onClick={doExport}><Icon name="download" size={18} />Exportar CSV</button>
    </section>
  );
}
