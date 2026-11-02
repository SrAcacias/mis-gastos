import { useEffect, useState } from 'preact/hooks';
import { useStore, useToast, isLocal, signIn, signUp } from './store.js';
import { currentMonth } from './lib.js';
import { Icon } from './components.jsx';
import Summary from './screens/Summary.jsx';
import Movements from './screens/Movements.jsx';
import Edit from './screens/Edit.jsx';
import Chart from './screens/Chart.jsx';
import Car from './screens/Car.jsx';
import Settings from './screens/Settings.jsx';

function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

export function App() {
  const s = useStore();
  const toast = useToast();
  const [route, setRoute] = useState(parseHash());
  const [month, setMonth] = useState(currentMonth());

  useEffect(() => {
    const on = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  if (!s.user && s.ready) return <Auth />;
  if (!s.ready || !s.settings) return <div class="loading">{s.error ? `Error: ${s.error}` : 'Cargando…'}</div>;

  const [p0, p1] = route.parts;
  let screen; let active = p0 || 'resumen';
  if (!p0) screen = <Summary month={month} setMonth={setMonth} />;
  else if (p0 === 'movimientos') screen = <Movements month={month} setMonth={setMonth} />;
  else if (p0 === 'nuevo') { screen = <Edit key={`new-${JSON.stringify(route.query)}`} query={route.query} />; active = 'nuevo'; }
  else if (p0 === 'editar') { screen = <Edit key={p1} id={p1} />; active = 'movimientos'; }
  else if (p0 === 'grafico') screen = <Chart />;
  else if (p0 === 'coche') screen = <Car />;
  else if (p0 === 'ajustes') screen = <Settings />;
  else screen = <Summary month={month} setMonth={setMonth} />;

  const links = [
    ['resumen', '#/', 'chart', 'Resumen'],
    ['movimientos', '#/movimientos', 'list', 'Movimientos'],
    ['grafico', '#/grafico', 'trend', 'Gráfico'],
    ['coche', '#/coche', 'car', 'Coche'],
    ['ajustes', '#/ajustes', 'settings', 'Ajustes']
  ];

  return (
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark"><Icon name="chart" size={18} stroke={2.2} /></span>Mis gastos</div>
        <a class="btn side-add" href="#/nuevo"><Icon name="plus" size={18} stroke={2.5} />Añadir movimiento</a>
        <nav class="side-nav" aria-label="Secciones">
          {links.map(([k, href, icon, label]) => (
            <a class={`side-link ${active === k ? 'active' : ''}`} href={href} aria-current={active === k ? 'page' : undefined}><Icon name={icon} size={20} />{label}</a>
          ))}
        </nav>
        {isLocal && <div class="local-banner">Modo local: sin sincronizar</div>}
      </aside>
      <main class="main">{screen}</main>
      <nav class="tabbar" aria-label="Secciones">
        {[links[0], links[1], ['nuevo', '#/nuevo', 'plus', 'Añadir'], links[2], links[4]].map(([k, href, icon, label]) => (
          <a class={`tab ${active === k ? 'active' : ''}`} href={href} aria-current={active === k ? 'page' : undefined}>
            {k === 'nuevo' ? <span class="tab-add"><Icon name="plus" size={22} stroke={2.5} /></span> : <Icon name={icon} />}
            {label}
          </a>
        ))}
      </nav>
      {toast && <div class="toast" role="status">{toast}</div>}
    </div>
  );
}

function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      if (mode === 'login') await signIn(email, pass);
      else {
        const d = await signUp(email, pass);
        if (!d.session) setMsg('Cuenta creada. Revisa tu email para confirmarla y después entra.');
      }
    } catch (err) {
      setMsg(err.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : err.message);
    } finally { setBusy(false); }
  };
  return (
    <div class="auth">
      <form class="card" onSubmit={submit}>
        <div class="brand" style={{ padding: 0 }}><span class="brand-mark"><Icon name="chart" size={18} stroke={2.2} /></span>Mis gastos</div>
        <h1 class="title" style={{ fontSize: '24px' }}>{mode === 'login' ? 'Entrar' : 'Crear cuenta'}</h1>
        <label class="field">Email<input class="input" type="email" autocomplete="email" required value={email} onInput={(e) => setEmail(e.target.value)} /></label>
        <label class="field">Contraseña<input class="input" type="password" autocomplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required value={pass} onInput={(e) => setPass(e.target.value)} /></label>
        {msg && <p class="notice" role="alert">{msg}</p>}
        <button class="btn big" disabled={busy}>{busy ? '…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
        <button type="button" class="btn ghost" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg(null); }}>
          {mode === 'login' ? 'Es la primera vez: crear cuenta' : 'Ya tengo cuenta: entrar'}
        </button>
      </form>
    </div>
  );
}
