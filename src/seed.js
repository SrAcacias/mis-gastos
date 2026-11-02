// Datos iniciales (se crean una sola vez, la primera vez que entras)

export const SEED_CATEGORIES = [
  { name: 'Restaurantes y bares', kind: 'gasto', color: '#C2410C' },
  { name: 'Ocio',                 kind: 'gasto', color: '#7C3AED' },
  { name: 'Coche',                kind: 'gasto', color: '#1D4ED8' },
  { name: 'Deporte',              kind: 'gasto', color: '#0F766E' },
  { name: 'Formación',            kind: 'gasto', color: '#B45309' },
  { name: 'Trabajo',              kind: 'gasto', color: '#374151' },
  { name: 'Música',               kind: 'gasto', color: '#BE185D' },
  { name: 'Cuidado personal',     kind: 'gasto', color: '#0E7490' },
  { name: 'Salud',                kind: 'gasto', color: '#15803D' },
  { name: 'Otros',                kind: 'gasto', color: '#6B7280' },
  { name: 'Clases de pádel',      kind: 'ingreso', color: '#0F766E' },
  { name: 'Otros ingresos',       kind: 'ingreso', color: '#6B7280' }
];

// Gastos fijos de septiembre 2026: se generan solos desde octubre
const r = (concept, euros, category) => ({
  concept, category, kind: 'gasto', amount_cents: Math.round(euros * 100),
  method: 'banco', frequency: 'monthly', next_date: '2026-10-01', active: true
});
export const SEED_RULES = [
  r('Préstamo coche', 243, 'Coche'),
  r('Gestoría', 53, 'Trabajo'),
  r('Gimnasio', 23, 'Deporte'),
  r('Apple', 2.99, 'Otros'),
  r('Curso J3', 49, 'Formación'),
  r('Cuota autónomos', 88.64, 'Trabajo'),
  r('STMove', 180, 'Otros'),
  r('Claude y Gemini', 30, 'Otros')
];

// Septiembre: km de inicio y precio del Excel; falta meter los km de final de mes
export const SEED_CAR_LOGS = [
  { month: '2026-09', km_start: 46676, km_end: null, price_per_l: 1.71, km_per_l: 16.67 }
];
