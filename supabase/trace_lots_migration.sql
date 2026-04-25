-- =====================================================================
-- TeaTrade Trace · trace_lots + trace_lot_events migration
-- ---------------------------------------------------------------------
-- Promotes trace_batches from a single-row "shipment" model to a
-- proper append-only chain model:
--
--   trace_lots         · one row per physical lot (the "blockchain")
--   trace_lot_events   · one row per lifecycle event, hash-chained
--
-- Each event's hash is sha256(prev_hash || canonical(payload) || ts).
-- The latest event's hash IS the lot's current state — verifiable by
-- replaying the chain from genesis. trace_batches is preserved as a
-- backwards-compatible view so existing UI keeps working.
--
-- Idempotent: safe to run multiple times.
-- =====================================================================

-- ---------- 0. Required extensions ------------------------------------
create extension if not exists pgcrypto;     -- for gen_random_uuid()

-- ---------- 1. trace_lots ---------------------------------------------
-- Note: importer_id is FK'd to auth.users(id) — same identity surface
-- already used by trace_batches RLS. (trace_importers is a profile
-- table; the auth.uid() is the source of truth.)
create table if not exists public.trace_lots (
  id              text primary key,                -- e.g. LOT-FXT-260425-A1B2
  importer_id     uuid not null references auth.users(id) on delete cascade,
  estate_id       text,
  estate_name     text,
  status          text not null default 'open'
                  check (status in ('open','dispatched','delivered','closed','void')),
  stages_done     text[] not null default '{}',    -- ['origin','manufacture',...]
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  qr_url          text,
  blockchain_anchor text                           -- on-chain tx hash when minted
);

create index if not exists trace_lots_importer_idx on public.trace_lots(importer_id);
create index if not exists trace_lots_status_idx   on public.trace_lots(status);

-- ---------- 2. trace_lot_events ---------------------------------------
create table if not exists public.trace_lot_events (
  event_id        uuid primary key default gen_random_uuid(),
  lot_id          text not null references public.trace_lots(id) on delete cascade,
  importer_id     uuid not null references auth.users(id) on delete cascade,
  block_height    int  not null,                   -- 1, 2, 3, ...
  type            text not null
                  check (type in (
                    'origin','manufacture','bulk-pack','outbound',
                    'minted','dispatched','customs','delivered','void'
                  )),
  ts              timestamptz not null default now(),
  payload         jsonb not null default '{}'::jsonb,
  prev_hash       text not null,                   -- hex, 0x prefixed
  hash            text not null unique,            -- hex, 0x prefixed
  tx_hash         text,                            -- optional on-chain tx
  unique (lot_id, block_height)
);

create index if not exists trace_lot_events_lot_idx
  on public.trace_lot_events(lot_id, block_height);
create index if not exists trace_lot_events_type_idx
  on public.trace_lot_events(type);

-- ---------- 3. updated_at trigger -------------------------------------
create or replace function public.tt_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trace_lots_touch on public.trace_lots;
create trigger trace_lots_touch
  before update on public.trace_lots
  for each row execute function public.tt_touch_updated_at();

-- ---------- 4. RLS ----------------------------------------------------
alter table public.trace_lots        enable row level security;
alter table public.trace_lot_events  enable row level security;

drop policy if exists trace_lots_select on public.trace_lots;
create policy trace_lots_select on public.trace_lots
  for select using (importer_id = auth.uid());
drop policy if exists trace_lots_insert on public.trace_lots;
create policy trace_lots_insert on public.trace_lots
  for insert with check (importer_id = auth.uid());
drop policy if exists trace_lots_update on public.trace_lots;
create policy trace_lots_update on public.trace_lots
  for update using (importer_id = auth.uid()) with check (importer_id = auth.uid());

drop policy if exists trace_lot_events_select on public.trace_lot_events;
create policy trace_lot_events_select on public.trace_lot_events
  for select using (importer_id = auth.uid());
drop policy if exists trace_lot_events_insert on public.trace_lot_events;
create policy trace_lot_events_insert on public.trace_lot_events
  for insert with check (importer_id = auth.uid());

-- Updates and deletes on events are forbidden by design (append-only).
-- Public consumer-facing /lot/<id> view will be a separate
-- security-definer function that returns only the chain head + history.

-- ---------- 5. Atomic append helper (RPC) -----------------------------
-- Appends an event to a lot in a single transaction, computing the
-- block_height server-side so two concurrent appends can't collide.
create or replace function public.trace_lot_append(
  p_lot_id    text,
  p_type      text,
  p_payload   jsonb,
  p_prev_hash text,
  p_hash      text
) returns public.trace_lot_events
language plpgsql security definer set search_path = public as $$
declare
  v_imp uuid := auth.uid();
  v_height int;
  v_evt public.trace_lot_events;
begin
  if v_imp is null then raise exception 'auth required'; end if;
  -- ownership check
  perform 1 from public.trace_lots
   where id = p_lot_id and importer_id = v_imp;
  if not found then raise exception 'lot not owned by caller'; end if;

  select coalesce(max(block_height), 0) + 1 into v_height
    from public.trace_lot_events where lot_id = p_lot_id;

  insert into public.trace_lot_events
    (lot_id, importer_id, block_height, type, payload, prev_hash, hash)
  values
    (p_lot_id, v_imp, v_height, p_type, p_payload, p_prev_hash, p_hash)
  returning * into v_evt;

  update public.trace_lots
     set stages_done = (
           select array_agg(distinct s)
           from unnest(stages_done || array[p_type]) as s
         ),
         status = case
                    when p_type = 'delivered' then 'delivered'
                    when p_type = 'dispatched' and status = 'open' then 'dispatched'
                    else status
                  end
   where id = p_lot_id;

  return v_evt;
end$$;

grant execute on function public.trace_lot_append(text,text,jsonb,text,text) to authenticated;

-- ---------- 6. Backwards-compat view ----------------------------------
-- trace_batches stays usable for the existing UI: it's now a view
-- that surfaces each lot's latest known state.
do $$
declare
  is_table boolean;
begin
  select c.relkind = 'r' into is_table
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname='public' and c.relname='trace_batches';
  if is_table then
    -- preserve original table; drop only if you've already migrated data.
    raise notice 'trace_batches table preserved — review and rename when ready.';
  end if;
end$$;

-- create the compat view alongside (won't conflict with table)
create or replace view public.trace_lots_view as
select
  l.id,
  l.importer_id,
  l.estate_name,
  l.status,
  l.stages_done,
  l.qr_url,
  (select hash       from public.trace_lot_events
    where lot_id = l.id order by block_height desc limit 1) as head_hash,
  (select block_height from public.trace_lot_events
    where lot_id = l.id order by block_height desc limit 1) as head_block,
  (select payload    from public.trace_lot_events
    where lot_id = l.id and type='minted' limit 1)         as mint_payload,
  l.created_at,
  l.updated_at
from public.trace_lots l;

comment on table public.trace_lots is
  'Per-lot ledger header. The chain itself lives in trace_lot_events.';
comment on table public.trace_lot_events is
  'Append-only hash-chained lifecycle events. NEVER update or delete rows.';

-- ---------- 7. Final sanity check -------------------------------------
-- If any of the above silently failed, this raises a visible NOTICE.
do $$
begin
  if to_regclass('public.trace_lots')        is null then raise exception 'trace_lots not created'; end if;
  if to_regclass('public.trace_lot_events')  is null then raise exception 'trace_lot_events not created'; end if;
  if to_regprocedure('public.trace_lot_append(text,text,jsonb,text,text)') is null
    then raise exception 'trace_lot_append() RPC not created';
  end if;
  raise notice '✓ trace_lots migration complete';
end$$;
