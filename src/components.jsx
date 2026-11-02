import { useEffect, useRef } from 'preact/hooks';
import { addMonths, monthLabel, fmtEUR, shortDate } from './lib.js';

const P = {
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trend: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  settings: <g><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></g>,
  car: <g><path d="M5 17h14M5 17a2 2 0 1 1-4 0v-4l2-6h16l2 6v4a2 2 0 1 1-4 0" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></g>,
  left: <path d="M15 18l-6-6 6-6" />,
  right: <path d="M9 18l6-6-6-6" />,
  search: <g><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></g>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  repeat: <path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />,
  check: <path d="M5 12l5 5L20 7" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  upload: <path d="M12 21V9M7 14l5-5 5 5M5 3h14" />,
  alert: <g><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5h.01" /></g>,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />
};

export function Icon({ name, size = 22, stroke = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}

export function MonthNav({ month, setMonth, max, spread }) {
  return (
    <div class={`month-nav ${spread ? 'spread' : ''}`}>
      <button class="icon-btn" aria-label="Mes anterior" onClick={() => setMonth(addMonths(month, -1))}><Icon name="left" size={20} /></button>
      <h1>{monthLabel(month)}</h1>
      <button class="icon-btn" aria-label="Mes siguiente" disabled={max && month >= max} onClick={() => setMonth(addMonths(month, 1))}><Icon name="right" size={20} /></button>
    </div>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div class="segmented" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

export function Avatar({ cat, kind }) {
  const letter = (cat?.name || (kind === 'ingreso' ? 'I' : '?')).charAt(0).toUpperCase();
  return <div class="avatar" aria-hidden="true">{letter}</div>;
}

export function TxRow({ tx, cat, showDate, dateLabel }) {
  const inc = tx.kind === 'ingreso';
  return (
    <a class="row" href={`#/editar/${tx.id}`}>
      <Avatar cat={cat} kind={tx.kind} />
      <div class="row-main">
        <span class="row-title">{tx.concept || cat?.name || 'Sin concepto'}</span>
        <span class="row-sub">
          <span>{cat?.name || 'Sin categoría'}{showDate ? ` · ${dateLabel}` : ''}</span>
          {tx.method === 'efectivo' && <span class="pill">Efectivo</span>}
          {tx.recurring_id && <span class="pill">Fijo</span>}
          {tx.car_log_id && <span class="pill">Km</span>}
        </span>
      </div>
      <span class={`row-amount num ${inc ? 'income' : ''}`}>{fmtEUR(inc ? tx.amount_cents : -tx.amount_cents)}</span>
    </a>
  );
}

export function Dialog({ title, children, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.querySelector('button, input, select')?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, []);
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div class="dialog" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function TxTable({ list, cats, showYear }) {
  return (
    <div class="scroll-x">
      <table class="tbl tx-table">
        <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th class="r">Importe</th></tr></thead>
        <tbody>
          {list.map((x) => {
            const inc = x.kind === 'ingreso';
            const cat = cats[x.category_id];
            return (
              <tr onClick={() => (location.hash = `#/editar/${x.id}`)}>
                <td class="muted nowrap">{shortDate(x.date)}{showYear ? ` ${x.date.slice(2, 4)}` : ''}</td>
                <td><a class="tx-link" href={`#/editar/${x.id}`}>{x.concept || cat?.name || 'Sin concepto'}</a>
                  {x.method === 'efectivo' && <span class="pill" style={{ marginLeft: '6px' }}>Efectivo</span>}
                </td>
                <td><span class="pill">{inc && !cat ? 'Ingreso' : cat?.name || 'Sin categoría'}</span></td>
                <td class={`r num strong ${inc ? 'income' : ''}`}>{fmtEUR(inc ? x.amount_cents : -x.amount_cents)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
