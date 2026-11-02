import { render } from 'preact';
import { App } from './app.jsx';
import { initAuth, applyTheme } from './store.js';
import './styles.css';

// Aplica el último tema guardado antes de cargar datos (evita parpadeo)
try { applyTheme(JSON.parse(localStorage.getItem('mis-gastos-theme')) || { theme: 'teal', mode: 'light' }); } catch { applyTheme({ theme: 'teal', mode: 'light' }); }

render(<App />, document.getElementById('app'));
initAuth();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
