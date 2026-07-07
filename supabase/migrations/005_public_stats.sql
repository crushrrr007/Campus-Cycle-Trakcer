-- ============================================================================
-- CycleNet — 005: Public fleet stats RPC
-- Exposes ONLY aggregate counts (no row data) to anonymous visitors so the
-- sign-in page can show live "Bikes on campus" / "Smart stations" numbers.
-- Run AFTER 002_app_schema.sql. Safe to re-run.
-- ============================================================================

create or replace function public.public_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'bikes',    (select count(*) from public.bikes),
    'stations', (select count(*) from public.stations)
  );
$$;

-- Anonymous visitors (sign-in page) and signed-in users may call it.
grant execute on function public.public_stats() to anon, authenticated;
