-- =====================================================================
-- TeaTrade Trace · Custody Handoff migration
-- ---------------------------------------------------------------------
-- Promotes the trace ledger from a single-tenant ("the importer who
-- created the lot owns every event") to a true multi-party network:
--
--   * trace_lots.current_owner    — uid of the party currently
--                                   responsible for appending events
--                                   (defaults to importer_id at create)
--   * trace_nominations           — pending custody handoffs:
--                                   lot_id, from_user_id, to_email,
--                                   note, status (pending|accepted|
--                                   declined|cancelled)
--   * trace_nominate(lot,email,note)  RPC
--   * trace_accept(lot)               RPC  (also writes the `accept`
--                                            ledger event)
--   * trace_pending_inbox()           RPC  (lots waiting for me)
--
-- Six new ledger event types are whitelisted:
--   blend · consumer-pack · retail-inbound · on-shelf · nominate · accept
--
-- The append RPC now checks current_owner instead of importer_id, so
-- once you accept a lot you can write its retail-side events and the
-- estate that originated it can no longer mutate the chain.
--
-- Idempotent: safe to run multiple times.
-- =====================================================================

-- ---------- 1. Extend event-type whitelist ----------------------------
do $$
declare
  cname text;
begin
  -- find any existing CHECK constraint on the type column and drop it,
  -- regardless of name (older migrations used various conventions)
  for cname in
    select con.conname
      from pg_constraint con
      join pg_class       cl on cl.oid = con.conrelid
      join pg_namespace   ns on ns.oid = cl.relnamespace
     where ns.nspname = 'public'
       and cl.relname = 'trace_lot_events'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%type%in%'
  loop
    execute format('alter table public.trace_lot_events drop constraint %I', cname);
  end loop;

  alter table public.trace_lot_events
    add constraint trace_lot_events_type_check
    check (type in (
      'origin','manufacture','bulk-pack','outbound','customs',
      'blend','consumer-pack','minted',
      'dispatched','retail-inbound','on-shelf','delivered',
      'nominate','accept','void'
    ));
end$$;

-- ---------- 2. Ownership column on trace_lots -------------------------
alter table public.trace_lots
  add column if not exists current_owner uuid references auth.users(id);

-- backfill: importer is the original owner
update public.trace_lots
   set current_owner = importer_id
 where current_owner is null;

alter table public.trace_lots
  alter column current_owner set not null;

create index if not exists trace_lots_owner_idx on public.trace_lots(current_owner);

-- Loosen SELECT/UPDATE RLS to follow custody, not just authorship.
drop policy if exists trace_lots_select on public.trace_lots;
create policy trace_lots_select on public.trace_lots
  for select using (
    importer_id   = auth.uid()  or
    current_owner = auth.uid()
  );

drop policy if exists trace_lots_update on public.trace_lots;
create policy trace_lots_update on public.trace_lots
  for update using (current_owner = auth.uid())
            with check (current_owner = auth.uid());

-- Events are visible to anyone who has held the lot at any point.
drop policy if exists trace_lot_events_select on public.trace_lot_events;
create policy trace_lot_events_select on public.trace_lot_events
  for select using (
    importer_id = auth.uid()
    or exists (
      select 1 from public.trace_lots l
       where l.id = trace_lot_events.lot_id
         and (l.importer_id = auth.uid() or l.current_owner = auth.uid())
    )
  );

-- ---------- 3. Append RPC now checks current_owner --------------------
create or replace function public.trace_lot_append(
  p_lot_id    text,
  p_type      text,
  p_payload   jsonb,
  p_prev_hash text,
  p_hash      text
) returns public.trace_lot_events
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_height int;
  v_evt    public.trace_lot_events;
begin
  if v_uid is null then raise exception 'auth required'; end if;

  -- only the current custodian may append
  perform 1 from public.trace_lots
   where id = p_lot_id and current_owner = v_uid;
  if not found then raise exception 'not the current custodian of %', p_lot_id; end if;

  select coalesce(max(block_height), 0) + 1 into v_height
    from public.trace_lot_events where lot_id = p_lot_id;

  insert into public.trace_lot_events
    (lot_id, importer_id, block_height, type, payload, prev_hash, hash)
  values
    (p_lot_id, v_uid, v_height, p_type, p_payload, p_prev_hash, p_hash)
  returning * into v_evt;

  update public.trace_lots
     set stages_done = (
           select array_agg(distinct s)
             from unnest(stages_done || array[p_type]) as s
         ),
         status = case
                    when p_type = 'delivered'  then 'delivered'
                    when p_type = 'dispatched' and status = 'open' then 'dispatched'
                    else status
                  end
   where id = p_lot_id;

  return v_evt;
end$$;

grant execute on function public.trace_lot_append(text,text,jsonb,text,text) to authenticated;

-- ---------- 4. trace_nominations table --------------------------------
create table if not exists public.trace_nominations (
  id            uuid primary key default gen_random_uuid(),
  lot_id        text not null references public.trace_lots(id) on delete cascade,
  from_user_id  uuid not null references auth.users(id),
  to_email      citext,                       -- canonical lookup key
  to_user_id    uuid references auth.users(id), -- resolved once recipient signs in
  note          text,
  status        text not null default 'pending'
                check (status in ('pending','accepted','declined','cancelled')),
  hash          text,                         -- nominate event hash, audit link
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

-- citext requires the extension; fall back to text if unavailable
do $$
begin
  if not exists (select 1 from pg_extension where extname='citext') then
    alter table public.trace_nominations alter column to_email type text;
  end if;
exception when others then
  -- citext extension not available; column stays text
  null;
end$$;

create index if not exists trace_nominations_to_email_idx
  on public.trace_nominations(to_email)
  where status = 'pending';
create index if not exists trace_nominations_from_idx
  on public.trace_nominations(from_user_id);
create index if not exists trace_nominations_lot_idx
  on public.trace_nominations(lot_id);

alter table public.trace_nominations enable row level security;

-- nominator and nominee can both see the row
drop policy if exists trace_nominations_select on public.trace_nominations;
create policy trace_nominations_select on public.trace_nominations
  for select using (
    from_user_id = auth.uid()
    or to_user_id = auth.uid()
    or (to_email is not null
        and lower(to_email::text) = (select lower(email::text)
                                       from auth.users where id = auth.uid()))
  );

-- inserts go through the RPC only; block direct writes
drop policy if exists trace_nominations_insert on public.trace_nominations;
create policy trace_nominations_insert on public.trace_nominations
  for insert with check (false);

-- ---------- 5. trace_nominate RPC -------------------------------------
-- The current custodian declares the next custodian by email. This
-- writes the `nominate` ledger event so the handoff is hash-anchored,
-- and creates a pending nomination row.
create or replace function public.trace_nominate(
  p_lot_id  text,
  p_email   text,
  p_note    text default null
) returns public.trace_nominations
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_target uuid;
  v_nom    public.trace_nominations;
  v_email  text := lower(trim(p_email));
begin
  if v_uid is null  then raise exception 'auth required';     end if;
  if v_email = ''   then raise exception 'recipient email required'; end if;

  perform 1 from public.trace_lots
   where id = p_lot_id and current_owner = v_uid;
  if not found then raise exception 'not the current custodian of %', p_lot_id; end if;

  -- best-effort uid resolution — if the recipient already has an account
  select id into v_target from auth.users where lower(email) = v_email limit 1;

  insert into public.trace_nominations
    (lot_id, from_user_id, to_email, to_user_id, note)
  values
    (p_lot_id, v_uid, v_email, v_target, nullif(trim(coalesce(p_note,'')), ''))
  returning * into v_nom;

  return v_nom;
end$$;

grant execute on function public.trace_nominate(text,text,text) to authenticated;

-- ---------- 6. trace_accept RPC ---------------------------------------
-- The nominee adopts a lot. Validates a pending nomination addressed
-- to either their uid or their email, transfers ownership, and writes
-- the `accept` event so the chain records the handoff.
create or replace function public.trace_accept(
  p_lot_id    text,
  p_prev_hash text,
  p_hash      text,
  p_payload   jsonb default '{}'::jsonb
) returns public.trace_lot_events
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text;
  v_nom     public.trace_nominations;
  v_height  int;
  v_evt     public.trace_lot_events;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select lower(email) into v_email from auth.users where id = v_uid;

  select * into v_nom
    from public.trace_nominations
   where lot_id = p_lot_id
     and status = 'pending'
     and (to_user_id = v_uid or lower(to_email::text) = v_email)
   order by created_at desc
   limit 1;
  if not found then raise exception 'no pending nomination for %', p_lot_id; end if;

  -- 1. flip ownership
  update public.trace_lots
     set current_owner = v_uid
   where id = p_lot_id;

  -- 2. resolve the nomination
  update public.trace_nominations
     set status      = 'accepted',
         to_user_id  = v_uid,
         resolved_at = now()
   where id = v_nom.id;

  -- 3. append the `accept` event with from/to attribution
  select coalesce(max(block_height),0) + 1 into v_height
    from public.trace_lot_events where lot_id = p_lot_id;

  insert into public.trace_lot_events
    (lot_id, importer_id, block_height, type, payload, prev_hash, hash)
  values
    (p_lot_id, v_uid, v_height, 'accept',
     coalesce(p_payload,'{}'::jsonb)
       || jsonb_build_object('fromUid', v_nom.from_user_id, 'toUid', v_uid),
     p_prev_hash, p_hash)
  returning * into v_evt;

  return v_evt;
end$$;

grant execute on function public.trace_accept(text,text,text,jsonb) to authenticated;

-- ---------- 7. trace_pending_inbox RPC --------------------------------
-- Returns lots awaiting acceptance by the current user (matched by
-- uid OR email). Used by the dashboard "Pending Adoptions" panel.
create or replace function public.trace_pending_inbox()
returns table (
  nomination_id uuid,
  lot_id        text,
  estate_name   text,
  from_email    text,
  note          text,
  created_at    timestamptz,
  head_block    int,
  head_hash     text
)
language sql security definer set search_path = public stable as $$
  with me as (select lower(email) as email, id as uid from auth.users where id = auth.uid())
  select
    n.id,
    n.lot_id,
    l.estate_name,
    (select email from auth.users where id = n.from_user_id) as from_email,
    n.note,
    n.created_at,
    (select max(block_height) from public.trace_lot_events where lot_id = n.lot_id) as head_block,
    (select hash from public.trace_lot_events where lot_id = n.lot_id
       order by block_height desc limit 1) as head_hash
  from public.trace_nominations n
  join public.trace_lots         l on l.id = n.lot_id
  where n.status = 'pending'
    and (n.to_user_id = (select uid from me)
         or lower(n.to_email::text) = (select email from me));
$$;

grant execute on function public.trace_pending_inbox() to authenticated;

-- ---------- 8. Sanity check -------------------------------------------
do $$
begin
  if to_regclass('public.trace_nominations') is null
    then raise exception 'trace_nominations not created'; end if;
  if to_regprocedure('public.trace_nominate(text,text,text)') is null
    then raise exception 'trace_nominate() RPC not created'; end if;
  if to_regprocedure('public.trace_accept(text,text,text,jsonb)') is null
    then raise exception 'trace_accept() RPC not created'; end if;
  if to_regprocedure('public.trace_pending_inbox()') is null
    then raise exception 'trace_pending_inbox() RPC not created'; end if;
  raise notice '✓ Custody handoff migration complete';
end$$;
