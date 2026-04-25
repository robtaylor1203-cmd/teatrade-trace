-- =====================================================================
-- TeaTrade Trace · admin user + dummy data seed
-- Run AFTER trace_schema.sql AND trace_lots_migration.sql.
-- Marks contact@teatrade.co.uk as admin and seeds 12 demo lots the
-- first time that user signs in (idempotent — safe to re-run).
-- =====================================================================

-- ---------- 1. Admin flag --------------------------------------------
alter table public.trace_importers
  add column if not exists is_admin boolean not null default false;


-- ---------- 2. Seed routine ------------------------------------------
-- Inserts one trace_lots row + a hash-chained genesis 'minted' event in
-- trace_lot_events for each demo lot, so the seeded data is replayable
-- and indistinguishable from real wizard output.
create or replace function public.trace_seed_demo_for(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_lot   record;
  v_hash  text;
  v_payload jsonb;
begin
  -- Only seed if this importer has no lots yet.
  select count(*) into v_count
    from public.trace_lots
    where importer_id = p_user;

  if v_count > 0 then
    return;
  end if;

  -- 12 demo lots: id, estate, msku, packaging_format, packaging_material,
  -- weight_t, co2_transport, co2_packaging, total_co2, status
  for v_lot in
    select * from (values
      ('LOT-GLN-260101-A1B2','Glenburn Estate, India',       'MSKU1024788','pyramid','tin',       9.6, 1.84, 1.42, 3.26,'dispatched'),
      ('LOT-SAT-260103-C3D4','Satemwa Estate, Malawi',       'MSCU7710456','standard','cardboard',12.4,2.10, 0.74, 2.84,'dispatched'),
      ('LOT-UVA-260108-E5F6','Uva Highlands, Sri Lanka',     'CMAU3308819','loose','foil',         6.8, 1.21, 0.71, 1.92,'dispatched'),
      ('LOT-NUW-260112-G7H8','Nuwara Eliya Co-op, Sri Lanka','CMAU2049915','standard','cardboard',14.2,2.30, 0.81, 3.11,'dispatched'),
      ('LOT-KER-260118-I9J0','Kericho Highlands, Kenya',     'MSCU8821044','standard','cardboard',28.4,3.40, 1.02, 4.42,'dispatched'),
      ('LOT-TON-260124-K1L2','Tongmu Village, China',        'EGHU2210774','loose','tin',          2.1, 0.62, 0.48, 1.10,'dispatched'),
      ('LOT-MAN-260203-M3N4','Mangalam Estate, Assam',       'HLXU4471002','standard','foil',     18.2,2.60, 0.92, 3.52,'dispatched'),
      ('LOT-MAK-260210-O5P6','Makaibari Estate, India',      'MSKU3398170','pyramid','cardboard',  4.8, 0.94, 0.34, 1.28,'dispatched'),
      ('LOT-UJI-260218-Q7R8','Ujidake Gardens, Japan',       'EGHU5512446','loose','tin',          1.6, 0.41, 0.36, 0.77,'dispatched'),
      ('LOT-ANS-260301-S9T0','Anseong Green, South Korea',   'MSCU6620083','loose','cardboard',    2.4, 0.52, 0.22, 0.74,'dispatched'),
      ('LOT-KER-260311-U1V2','Kericho Highlands, Kenya',     'HLXU9930221','standard','foil',     32.1,3.92, 1.18, 5.10,'dispatched'),
      ('LOT-GLN-260322-W3X4','Glenburn Estate, India',       'MSKU4407110','pyramid','cardboard',  6.4, 1.30, 0.72, 2.02,'dispatched')
    ) as t(id, estate_name, msku, packaging_format, packaging_material,
           weight_t, co2_transport, co2_packaging, total_co2, status)
  loop
    -- 1. Lot header
    insert into public.trace_lots
      (id, importer_id, estate_name, status, stages_done)
    values
      (v_lot.id, p_user, v_lot.estate_name, v_lot.status,
       array['origin','manufacture','bulk-pack','minted','dispatched']);

    -- 2. Genesis 'minted' event — hash-chained from zero.
    v_payload := jsonb_build_object(
      'lot_id', v_lot.id,
      'estate', v_lot.estate_name,
      'msku', v_lot.msku,
      'packaging_format', v_lot.packaging_format,
      'packaging_material', v_lot.packaging_material,
      'weight_t', v_lot.weight_t,
      'co2_transport', v_lot.co2_transport,
      'co2_packaging', v_lot.co2_packaging,
      'total_co2', v_lot.total_co2
    );
    v_hash := '0x' || encode(
      extensions.digest(
        ('0x0000000000000000000000000000000000000000000000000000000000000000' ||
         v_payload::text || now()::text)::bytea,
        'sha256'
      ),
      'hex'
    );

    insert into public.trace_lot_events
      (lot_id, importer_id, block_height, type, payload, prev_hash, hash)
    values
      (v_lot.id, p_user, 1, 'minted', v_payload,
       '0x0000000000000000000000000000000000000000000000000000000000000000',
       v_hash);
  end loop;
end;
$$;


-- ---------- 3. Promote contact@teatrade.co.uk on signup --------------
-- Replace the basic trigger from trace_schema.sql with one that:
--   • sets company_name = 'TeaTrade Admin' for the admin email
--   • flags is_admin = true
--   • seeds demo batches once
create or replace function public.trace_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_email text := 'contact@teatrade.co.uk';
  v_is_admin    boolean := lower(new.email) = v_admin_email;
  v_company     text := coalesce(
    new.raw_user_meta_data->>'company_name',
    case when v_is_admin then 'TeaTrade Admin' else 'New Importer' end
  );
begin
  insert into public.trace_importers (id, company_name, is_admin)
  values (new.id, v_company, v_is_admin)
  on conflict (id) do update
    set is_admin = excluded.is_admin,
        company_name = case
          when public.trace_importers.company_name = 'New Importer'
          then excluded.company_name
          else public.trace_importers.company_name
        end;

  if v_is_admin then
    perform public.trace_seed_demo_for(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists trace_on_auth_user_created on auth.users;
create trigger trace_on_auth_user_created
  after insert on auth.users
  for each row execute function public.trace_handle_new_user();


-- ---------- 4. Backfill (if admin already exists) --------------------
-- If contact@teatrade.co.uk has already signed up before this script
-- ran, promote and seed them now.
do $$
declare
  v_uid uuid;
begin
  select id into v_uid
    from auth.users
    where lower(email) = 'contact@teatrade.co.uk'
    limit 1;

  if v_uid is not null then
    insert into public.trace_importers (id, company_name, is_admin)
    values (v_uid, 'TeaTrade Admin', true)
    on conflict (id) do update set is_admin = true,
                                   company_name = 'TeaTrade Admin';
    perform public.trace_seed_demo_for(v_uid);
  end if;
end $$;
