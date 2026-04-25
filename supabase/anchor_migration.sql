-- =====================================================================
-- TeaTrade Trace · Polygon anchor scaffold (DORMANT)
-- ---------------------------------------------------------------------
-- Adds the database side of public on-chain anchoring without changing
-- any existing app behaviour. The Edge Function `anchor-lot` (under
-- supabase/functions/anchor-lot) drains trace_anchor_queue and writes
-- the resulting tx_hash + block_number back into trace_anchors.
--
-- Anchoring strategy (recommended): one Merkle-root tx per UTC day.
--   • Cheap (~1 tx/day on Polygon PoS, fractions of a cent each)
--   • Every event is provable via its Merkle proof against that root
--   • Lot head hashes can also be anchored individually on `minted`
--     for instant cryptographic finality at issuance.
--
-- Until you (a) deploy the contract, (b) set the Edge Function env
-- vars, and (c) enable the cron, nothing here runs. Safe to apply now.
-- Idempotent.
-- =====================================================================

-- ---------- 1. trace_anchors -----------------------------------------
-- One row per successful on-chain write. Either anchors a single lot's
-- head hash (anchor_kind='head') or a daily Merkle root covering many
-- events (anchor_kind='daily-root').
create table if not exists public.trace_anchors (
  id              uuid primary key default gen_random_uuid(),
  anchor_kind     text not null check (anchor_kind in ('head','daily-root')),
  payload_hash    text not null,                  -- the bytes32 written on-chain
  lot_id          text references public.trace_lots(id) on delete set null,
  event_count     int  not null default 1,        -- 1 for head, N for daily-root
  merkle_leaves   jsonb,                          -- array of {event_id, hash} for daily-root
  chain_id        int  not null,                  -- e.g. 137 = Polygon PoS, 80002 = Amoy
  contract_addr   text not null,
  tx_hash         text not null unique,
  block_number    bigint,
  anchored_at     timestamptz not null default now()
);

create index if not exists trace_anchors_lot_idx
  on public.trace_anchors(lot_id);
create index if not exists trace_anchors_kind_idx
  on public.trace_anchors(anchor_kind, anchored_at desc);
create index if not exists trace_anchors_payload_idx
  on public.trace_anchors(payload_hash);

-- ---------- 2. trace_anchor_queue ------------------------------------
-- Work queue the Edge Function drains. Producers (the wizard's
-- `mint` flow + a nightly job) insert rows; the function consumes
-- the oldest pending row, submits a tx, and marks it complete.
create table if not exists public.trace_anchor_queue (
  id            uuid primary key default gen_random_uuid(),
  anchor_kind   text not null check (anchor_kind in ('head','daily-root')),
  payload_hash  text not null,
  lot_id        text references public.trace_lots(id) on delete cascade,
  merkle_leaves jsonb,
  status        text not null default 'pending'
                check (status in ('pending','processing','done','failed')),
  attempts      int  not null default 0,
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  anchor_id     uuid references public.trace_anchors(id) on delete set null
);

create index if not exists trace_anchor_queue_status_idx
  on public.trace_anchor_queue(status, created_at);

drop trigger if exists trace_anchor_queue_touch on public.trace_anchor_queue;
create trigger trace_anchor_queue_touch
  before update on public.trace_anchor_queue
  for each row execute function public.tt_touch_updated_at();

-- ---------- 3. anchor_status column on events ------------------------
-- Lets the UI/passport surface "Anchored on Polygon ✓" per event.
alter table public.trace_lot_events
  add column if not exists anchor_id uuid references public.trace_anchors(id) on delete set null;

create index if not exists trace_lot_events_anchor_idx
  on public.trace_lot_events(anchor_id);

-- ---------- 4. RLS ---------------------------------------------------
-- Anchors are PUBLIC by design — anyone with a passport URL can verify
-- against the chain. The queue is service-role only.
alter table public.trace_anchors       enable row level security;
alter table public.trace_anchor_queue  enable row level security;

drop policy if exists trace_anchors_public_select on public.trace_anchors;
create policy trace_anchors_public_select on public.trace_anchors
  for select using (true);

-- queue: no policies for anon/auth → only service_role (Edge Function) can touch.

-- ---------- 5. Helpers -----------------------------------------------
-- Enqueue the head hash of a lot. Called from the wizard's mint step.
-- (The wizard still works without anchoring — this is additive.)
create or replace function public.trace_enqueue_head_anchor(p_lot_id text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_imp     uuid := auth.uid();
  v_hash    text;
  v_queue_id uuid;
begin
  if v_imp is null then raise exception 'auth required'; end if;

  perform 1 from public.trace_lots
   where id = p_lot_id and importer_id = v_imp;
  if not found then raise exception 'lot not owned by caller'; end if;

  select hash into v_hash
    from public.trace_lot_events
   where lot_id = p_lot_id
   order by block_height desc
   limit 1;
  if v_hash is null then raise exception 'no events for lot %', p_lot_id; end if;

  insert into public.trace_anchor_queue (anchor_kind, payload_hash, lot_id)
  values ('head', v_hash, p_lot_id)
  returning id into v_queue_id;

  return v_queue_id;
end$$;

grant execute on function public.trace_enqueue_head_anchor(text) to authenticated;

-- Build today's daily-root work item from all events anchored since
-- the previous root. Run from a Supabase scheduled function (cron).
create or replace function public.trace_enqueue_daily_root()
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_since timestamptz;
  v_leaves jsonb;
  v_root  text;
  v_queue_id uuid;
begin
  -- Find the timestamp of the most recent daily-root anchor.
  select coalesce(max(anchored_at), 'epoch'::timestamptz) into v_since
    from public.trace_anchors where anchor_kind = 'daily-root';

  -- Collect every event hash since then, ordered deterministically.
  select jsonb_agg(jsonb_build_object('event_id', event_id, 'hash', hash)
                   order by ts, event_id),
         encode(
           extensions.digest(
             coalesce(string_agg(hash, '' order by ts, event_id), ''),
             'sha256'
           ),
           'hex'
         )
    into v_leaves, v_root
    from public.trace_lot_events
   where ts > v_since;

  if v_leaves is null or jsonb_array_length(v_leaves) = 0 then
    return null;  -- nothing new, nothing to anchor today
  end if;

  insert into public.trace_anchor_queue
    (anchor_kind, payload_hash, merkle_leaves)
  values
    ('daily-root', '0x' || v_root, v_leaves)
  returning id into v_queue_id;

  return v_queue_id;
end$$;

-- Service-role only.
revoke all on function public.trace_enqueue_daily_root() from public;

-- ---------- 6. Sanity check ------------------------------------------
do $$
begin
  if to_regclass('public.trace_anchors')      is null then raise exception 'trace_anchors not created'; end if;
  if to_regclass('public.trace_anchor_queue') is null then raise exception 'trace_anchor_queue not created'; end if;
  raise notice '✓ anchor scaffold installed (dormant until Edge Function deployed)';
end$$;
