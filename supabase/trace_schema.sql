-- =====================================================================
-- TeaTrade Trace · isolated schema on shared Supabase project
-- All Trace-specific objects use the `trace_` prefix to keep this
-- product cleanly separated from teatrade.co.uk and shipping.teatrade.co.uk
-- while still benefiting from a single auth.users table (SSO).
-- =====================================================================
--
-- ⚠️  LEGACY / SUPERSEDED — DO NOT RUN ON A FRESH PROJECT
-- ---------------------------------------------------------------------
-- This file is preserved for historical reference. The active schema is
-- now defined in `trace_lots_migration.sql`, which models lots as a
-- proper hash-chained ledger (`trace_lots` + `trace_lot_events`).
--
-- For a NEW Supabase project, run only:
--     1. trace_lots_migration.sql   (creates the live schema + RPC)
--     2. trace_seed_admin.sql       (admin flag + demo seed)
--
-- The `trace_batches` table this file creates is retained as a
-- backwards-compat shim only — new code should not target it.
-- =====================================================================

-- ---------- 1. EXTENSIONS ---------------------------------------------
create extension if not exists "pgcrypto";


-- ---------- 2. trace_importers ----------------------------------------
-- One row per Trace customer org. PK *is* auth.users(id) so the SSO
-- session uid maps directly to the importer record.
create table if not exists public.trace_importers (
  id            uuid primary key references auth.users(id) on delete cascade,
  company_name  text not null,
  created_at    timestamptz not null default now()
);

alter table public.trace_importers enable row level security;

-- Importers can read / update their OWN row only.
drop policy if exists "trace_importers_select_own" on public.trace_importers;
create policy "trace_importers_select_own"
  on public.trace_importers
  for select
  to authenticated
  using ( id = auth.uid() );

drop policy if exists "trace_importers_insert_self" on public.trace_importers;
create policy "trace_importers_insert_self"
  on public.trace_importers
  for insert
  to authenticated
  with check ( id = auth.uid() );

drop policy if exists "trace_importers_update_own" on public.trace_importers;
create policy "trace_importers_update_own"
  on public.trace_importers
  for update
  to authenticated
  using ( id = auth.uid() )
  with check ( id = auth.uid() );


-- ---------- 3. trace_batches ------------------------------------------
create table if not exists public.trace_batches (
  id                  uuid primary key default gen_random_uuid(),
  importer_id         uuid not null references public.trace_importers(id) on delete cascade,
  estate_name         text not null,
  msku                text not null,
  packaging_format    text not null check (packaging_format in (
    'whole-leaf','broken-leaf','fannings','dust','ctc','green-loose','other',
    'pyramid','standard','loose'
  )),
  packaging_material  text not null check (packaging_material in (
    'paper-sack','foil-sack','jute-sack','tea-chest','bulk-bin','other',
    'cardboard','tin','foil'
  )),
  weight_t            numeric(8,2) not null check (weight_t > 0),
  co2_transport       numeric(10,3) not null default 0,
  co2_packaging       numeric(10,3) not null default 0,
  total_co2           numeric(10,3) not null default 0,
  hash                text,
  status              text not null default 'pending'
                       check (status in ('pending','transit','port','cleared','rejected')),
  created_at          timestamptz not null default now()
);

create index if not exists trace_batches_importer_idx
  on public.trace_batches (importer_id, created_at desc);

alter table public.trace_batches enable row level security;

-- STRICT RLS: a logged-in importer can ONLY see / write rows where
-- importer_id matches their own auth.uid().
drop policy if exists "trace_batches_select_own" on public.trace_batches;
create policy "trace_batches_select_own"
  on public.trace_batches
  for select
  to authenticated
  using ( importer_id = auth.uid() );

drop policy if exists "trace_batches_insert_own" on public.trace_batches;
create policy "trace_batches_insert_own"
  on public.trace_batches
  for insert
  to authenticated
  with check ( importer_id = auth.uid() );

-- (Update / delete intentionally omitted — batches are append-only;
--  status changes happen via a dedicated edge function with service role.)


-- ---------- 4. Auto-provision trace_importers row on first sign-in ----
-- Optional convenience trigger: when a user signs up via SSO we create
-- a stub importer row so the RLS-protected inserts above immediately work.
create or replace function public.trace_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trace_importers (id, company_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'company_name', 'New Importer'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trace_on_auth_user_created on auth.users;
create trigger trace_on_auth_user_created
  after insert on auth.users
  for each row execute function public.trace_handle_new_user();
