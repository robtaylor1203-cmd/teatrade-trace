
create table if not exists public.trace_certificates (
  id            uuid primary key default gen_random_uuid(),
  lot_id        text not null references public.trace_lots(id) on delete cascade,
  importer_id   uuid not null references auth.users(id) on delete cascade,
  kind          text not null default 'tea-passport'
                check (kind in ('tea-passport','origin','organic','fairtrade','custom')),
  url           text not null,
  block_height  int,                          -- chain depth at time of issue
  hash          text,                         -- head hash at time of issue
  scan_count    int  not null default 0,
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists trace_certificates_lot_idx
  on public.trace_certificates(lot_id);
create index if not exists trace_certificates_importer_idx
  on public.trace_certificates(importer_id);

alter table public.trace_certificates enable row level security;

drop policy if exists trace_certificates_select on public.trace_certificates;
create policy trace_certificates_select on public.trace_certificates
  for select using (importer_id = auth.uid());
drop policy if exists trace_certificates_insert on public.trace_certificates;
create policy trace_certificates_insert on public.trace_certificates
  for insert with check (importer_id = auth.uid());
drop policy if exists trace_certificates_update on public.trace_certificates;
create policy trace_certificates_update on public.trace_certificates
  for update using (importer_id = auth.uid()) with check (importer_id = auth.uid());

create or replace function public.tt_public_passport(p_lot_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_lot     public.trace_lots%rowtype;
  v_events  jsonb;
  v_head    public.trace_lot_events%rowtype;
begin
  select * into v_lot from public.trace_lots where id = p_lot_id;
  if not found then
    return null;
  end if;

  select * into v_head
    from public.trace_lot_events
   where lot_id = p_lot_id
   order by block_height desc
   limit 1;

  select coalesce(jsonb_agg(e order by e->>'block_height'), '[]'::jsonb)
    into v_events
    from (
      select jsonb_build_object(
        'type',         type,
        'ts',           ts,
        'payload',      payload,
        'prev_hash',    prev_hash,
        'hash',         hash,
        'block_height', block_height,
        'tx_hash',      tx_hash
      ) as e
      from public.trace_lot_events
      where lot_id = p_lot_id
    ) sub;

  -- log a scan (best-effort; table may not yet have a row for this lot
  -- if no certificate was ever issued — that's fine, nothing to update)
  update public.trace_certificates
     set scan_count = scan_count + 1
   where lot_id = p_lot_id
     and kind   = 'tea-passport';

  return jsonb_build_object(
    'lot', jsonb_build_object(
      'id',           v_lot.id,
      'estate_id',    v_lot.estate_id,
      'estate_name',  v_lot.estate_name,
      'status',       v_lot.status,
      'stages_done',  v_lot.stages_done,
      'created_at',   v_lot.created_at,
      'qr_url',       v_lot.qr_url,
      'blockchain_anchor', v_lot.blockchain_anchor,
      'head_hash',    v_head.hash,
      'head_block',   v_head.block_height
    ),
    'events', v_events
  );
end$$;

grant execute on function public.tt_public_passport(text) to anon, authenticated;

do $$
begin
  if to_regclass('public.trace_certificates') is null
    then raise exception 'trace_certificates not created'; end if;
  if to_regprocedure('public.tt_public_passport(text)') is null
    then raise exception 'tt_public_passport() RPC not created'; end if;
  raise notice '✓ Tea Passport migration complete';
end$$;
