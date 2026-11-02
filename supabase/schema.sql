-- Mis gastos — esquema de base de datos para Supabase
-- Ejecutar UNA vez en: Supabase → SQL Editor → New query → pegar → Run

create extension if not exists pgcrypto;

-- Categorías -----------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  kind        text not null check (kind in ('gasto','ingreso')),
  color       text not null default '#0F766E',
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);

-- Gastos/ingresos recurrentes -----------------------------------------
create table if not exists public.recurring_rules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  concept       text not null,
  kind          text not null default 'gasto' check (kind in ('gasto','ingreso')),
  category_id   uuid references public.categories on delete set null,
  amount_cents  int  not null check (amount_cents > 0),
  method        text not null default 'banco' check (method in ('banco','efectivo')),
  frequency     text not null default 'monthly' check (frequency in ('monthly','yearly')),
  next_date     date not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Registro mensual de kilómetros del coche ---------------------------
create table if not exists public.car_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  month        text not null check (month ~ '^\d{4}-\d{2}$'),
  km_start     int,
  km_end       int,
  price_per_l  numeric(6,3),
  km_per_l     numeric(6,2),
  created_at   timestamptz not null default now(),
  unique (user_id, month)
);

-- Movimientos ----------------------------------------------------------
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  date          date not null,
  kind          text not null check (kind in ('gasto','ingreso')),
  concept       text not null default '',
  category_id   uuid references public.categories on delete set null,
  amount_cents  int  not null check (amount_cents > 0),
  method        text not null default 'banco' check (method in ('banco','efectivo')),
  recurring_id  uuid references public.recurring_rules on delete set null,
  car_log_id    uuid references public.car_logs on delete cascade,
  created_at    timestamptz not null default now()
);
create index if not exists transactions_user_date on public.transactions (user_id, date desc);
-- Evita duplicados si el Mac y el iPhone generan el mismo recurrente a la vez
create unique index if not exists transactions_recurring_once on public.transactions (recurring_id, date) where recurring_id is not null;
create unique index if not exists transactions_car_once on public.transactions (car_log_id) where car_log_id is not null;

-- Ajustes del usuario ---------------------------------------------------
create table if not exists public.settings (
  user_id         uuid primary key default auth.uid() references auth.users on delete cascade,
  theme           text not null default 'teal',
  mode            text not null default 'auto' check (mode in ('auto','light','dark')),
  km_per_l        numeric(6,2) not null default 16.67,
  shortcut_token  text unique,
  seeded          boolean not null default false,
  updated_at      timestamptz not null default now()
);

-- Seguridad: cada usuario solo ve y toca sus datos --------------------
alter table public.categories      enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.car_logs        enable row level security;
alter table public.transactions    enable row level security;
alter table public.settings        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['categories','recurring_rules','car_logs','transactions','settings'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Atajo de Siri: añade un gasto con una clave privada, sin abrir la app ----
create or replace function public.quick_add(
  p_token    text,
  p_amount   numeric,
  p_category text default null,
  p_concept  text default null,
  p_method   text default 'banco',
  p_kind     text default 'gasto'
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_cat  uuid;
  v_name text;
  v_kind text := case when lower(coalesce(p_kind,'gasto')) like 'ingreso%' then 'ingreso' else 'gasto' end;
  v_method text := case when lower(coalesce(p_method,'banco')) like 'efect%' then 'efectivo' else 'banco' end;
  v_cents int := round(coalesce(p_amount,0) * 100);
begin
  if p_token is null or length(p_token) < 20 then
    raise exception 'Clave no válida';
  end if;
  select user_id into v_user from settings where shortcut_token = p_token;
  if v_user is null then
    raise exception 'Clave no válida';
  end if;
  if v_cents <= 0 then
    raise exception 'El importe debe ser mayor que 0';
  end if;

  select id, name into v_cat, v_name from categories
   where user_id = v_user and kind = v_kind and lower(name) = lower(trim(coalesce(p_category,'')))
   limit 1;
  if v_cat is null then
    select id, name into v_cat, v_name from categories
     where user_id = v_user and kind = v_kind and lower(name) like 'otros%'
     order by sort limit 1;
  end if;

  insert into transactions (user_id, date, kind, concept, category_id, amount_cents, method)
  values (v_user, (now() at time zone 'Europe/Madrid')::date, v_kind,
          coalesce(nullif(trim(p_concept),''), v_name, ''), v_cat, v_cents, v_method);

  return 'Guardado: ' || replace(to_char(v_cents / 100.0, 'FM999990.00'), '.', ',') || ' € en ' || coalesce(v_name,'sin categoría');
end $$;

revoke all on function public.quick_add(text,numeric,text,text,text,text) from public;
grant execute on function public.quick_add(text,numeric,text,text,text,text) to anon, authenticated;
