-- =====================================================================
-- TeaTrade Trace · migration: raw-tea form + bulk-shipping packaging
-- ---------------------------------------------------------------------
-- Replaces the old finished-goods CHECK constraints on trace_batches
-- with raw-tea-side options. Legacy values are kept so historical rows
-- still validate. Also adds optional free-text columns for "Other".
-- =====================================================================

alter table public.trace_batches
  drop constraint if exists trace_batches_packaging_format_check,
  drop constraint if exists trace_batches_packaging_material_check;

alter table public.trace_batches
  add constraint trace_batches_packaging_format_check
    check (packaging_format in (
      'whole-leaf','broken-leaf','fannings','dust','ctc','green-loose','other',
      -- legacy finished-goods values (kept for historic rows)
      'pyramid','standard','loose'
    )),
  add constraint trace_batches_packaging_material_check
    check (packaging_material in (
      'paper-sack','foil-sack','jute-sack','tea-chest','bulk-bin','other',
      -- legacy finished-goods values
      'cardboard','tin','foil'
    ));

-- Free-text labels surfaced when the user picks "Other…" in the wizard
alter table public.trace_batches
  add column if not exists packaging_format_label   text,
  add column if not exists packaging_material_label text;
