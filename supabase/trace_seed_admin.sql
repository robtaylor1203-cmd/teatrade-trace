-- =====================================================================
-- TeaTrade Trace · admin user + dummy data seed
-- Run AFTER trace_schema.sql.
-- Marks contact@teatrade.co.uk as admin and seeds 12 demo batches the
-- first time that user signs in (idempotent — safe to re-run).
-- =====================================================================

-- ---------- 1. Admin flag --------------------------------------------
alter table public.trace_importers
  add column if not exists is_admin boolean not null default false;


-- ---------- 2. Seed routine ------------------------------------------
create or replace function public.trace_seed_demo_for(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- Only seed if this importer has no batches yet.
  select count(*) into v_count
    from public.trace_batches
    where importer_id = p_user;

  if v_count > 0 then
    return;
  end if;

  insert into public.trace_batches
    (importer_id, estate_name, msku, packaging_format, packaging_material,
     weight_t, co2_transport, co2_packaging, total_co2, hash, status)
  values
    (p_user,'Glenburn Estate, India',       'MSKU1024788','pyramid','tin',       9.6, 1.84, 1.42, 3.26,'0x8a1fd09277fe…','transit'),
    (p_user,'Satemwa Estate, Malawi',       'MSCU7710456','standard','cardboard',12.4,2.10, 0.74, 2.84,'0x4c27b118a002…','port'),
    (p_user,'Uva Highlands, Sri Lanka',     'CMAU3308819','loose','foil',         6.8, 1.21, 0.71, 1.92,'0x9e33a447fb1e…','transit'),
    (p_user,'Nuwara Eliya Co-op, Sri Lanka','CMAU2049915','standard','cardboard',14.2,2.30, 0.81, 3.11,'0x2b10f7561044…','cleared'),
    (p_user,'Kericho Highlands, Kenya',     'MSCU8821044','standard','cardboard',28.4,3.40, 1.02, 4.42,'0x7f88c201ae23…','transit'),
    (p_user,'Tongmu Village, China',        'EGHU2210774','loose','tin',          2.1, 0.62, 0.48, 1.10,'0x1d44a8803c91…','transit'),
    (p_user,'Mangalam Estate, Assam',       'HLXU4471002','standard','foil',     18.2,2.60, 0.92, 3.52,'0x6a02e3990ad4…','transit'),
    (p_user,'Makaibari Estate, India',      'MSKU3398170','pyramid','cardboard',  4.8, 0.94, 0.34, 1.28,'0x3c91b047ee50…','port'),
    (p_user,'Ujidake Gardens, Japan',       'EGHU5512446','loose','tin',          1.6, 0.41, 0.36, 0.77,'0x5f12d66839a7…','transit'),
    (p_user,'Anseong Green, South Korea',   'MSCU6620083','loose','cardboard',    2.4, 0.52, 0.22, 0.74,'0xb7e500c3ff22…','cleared'),
    (p_user,'Kericho Highlands, Kenya',     'HLXU9930221','standard','foil',     32.1,3.92, 1.18, 5.10,'0x2a77c4915780…','transit'),
    (p_user,'Glenburn Estate, India',       'MSKU4407110','pyramid','cardboard',  6.4, 1.30, 0.72, 2.02,'0x8d19b5029fcc…','cleared');
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
