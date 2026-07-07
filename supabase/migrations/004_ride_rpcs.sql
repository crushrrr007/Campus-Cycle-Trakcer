-- ============================================================================
-- CycleNet — 004: Borrow / return RPCs (security definer)
-- Run AFTER 002_app_schema.sql. Safe to re-run (create or replace).
--
-- Students cannot write to public.bikes directly (RLS is admin-only), so the
-- borrow/return flows go through these functions. They enforce, atomically:
--   • one active ride per user (also backed by the unique partial index)
--   • bike must be available (not in-use / maintenance)
--   • destination station must have a free dock on return
-- ============================================================================

-- ── Borrow a bicycle ─────────────────────────────────────────────────────────
create or replace function public.borrow_bike(p_bike_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_bike   public.bikes;
  v_active public.rides;
  v_ride   public.rides;
begin
  if v_user is null then
    return json_build_object('ok', false, 'message', 'You must be signed in to borrow a bicycle.');
  end if;

  -- One active ride per user
  select * into v_active
  from public.rides
  where user_id = v_user and status = 'active'
  limit 1;
  if found then
    return json_build_object(
      'ok', false,
      'message', 'You already have ' || v_active.bike_id || ' checked out. Return it before borrowing another.'
    );
  end if;

  -- Lock the bike row to avoid two people borrowing it simultaneously
  select * into v_bike
  from public.bikes
  where id = upper(p_bike_id) or qr = upper(p_bike_id)
  for update;
  if not found then
    return json_build_object('ok', false, 'message', 'No bicycle found for "' || p_bike_id || '".');
  end if;

  if v_bike.status = 'maintenance' then
    return json_build_object('ok', false, 'message', v_bike.id || ' is under maintenance and cannot be borrowed.');
  end if;
  if v_bike.status = 'in-use' then
    return json_build_object('ok', false, 'message', v_bike.id || ' is currently in use.');
  end if;
  if v_bike.station_id is null then
    return json_build_object('ok', false, 'message', v_bike.id || ' is not docked at a station right now.');
  end if;

  insert into public.rides (bike_id, user_id, source_station_id, status)
  values (v_bike.id, v_user, v_bike.station_id, 'active')
  returning * into v_ride;

  update public.bikes
  set status = 'in-use', station_id = null, usage_count = usage_count + 1
  where id = v_bike.id;

  return json_build_object(
    'ok', true,
    'message', v_bike.id || ' is now yours. Ride safe!',
    'ride_id', v_ride.id,
    'bike_id', v_bike.id
  );
exception when unique_violation then
  return json_build_object('ok', false, 'message', 'You already have an active ride. Return it before borrowing another bicycle.');
end;
$$;

-- ── Return a bicycle ─────────────────────────────────────────────────────────
create or replace function public.return_bike(p_bike_id text, p_dest_station_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_bike     public.bikes;
  v_ride     public.rides;
  v_station  public.stations;
  v_docked   integer;
  v_duration integer;
begin
  if v_user is null then
    return json_build_object('ok', false, 'message', 'You must be signed in to return a bicycle.');
  end if;

  select * into v_bike
  from public.bikes
  where id = upper(p_bike_id) or qr = upper(p_bike_id)
  for update;
  if not found then
    return json_build_object('ok', false, 'message', 'No bicycle found for "' || p_bike_id || '".');
  end if;
  if v_bike.status <> 'in-use' then
    return json_build_object('ok', false, 'message', v_bike.id || ' is not currently checked out.');
  end if;

  -- The active ride must belong to the caller (admins may return on behalf)
  select * into v_ride
  from public.rides
  where bike_id = v_bike.id and status = 'active'
    and (user_id = v_user or public.is_admin())
  limit 1;
  if not found then
    return json_build_object('ok', false, 'message', 'This bicycle is checked out by another rider.');
  end if;

  select * into v_station from public.stations where id = p_dest_station_id;
  if not found then
    return json_build_object('ok', false, 'message', 'Destination station not found.');
  end if;

  select count(*) into v_docked from public.bikes where station_id = v_station.id;
  if v_docked >= v_station.capacity then
    return json_build_object(
      'ok', false,
      'message', v_station.name || ' is full (' || v_docked || '/' || v_station.capacity || ' docks). Choose another station.'
    );
  end if;

  v_duration := greatest(1, round(extract(epoch from (now() - v_ride.borrow_time)) / 60)::integer);

  update public.rides
  set dest_station_id = v_station.id,
      return_time = now(),
      duration_min = v_duration,
      status = 'completed'
  where id = v_ride.id;

  update public.bikes
  set status = 'available', station_id = v_station.id
  where id = v_bike.id;

  return json_build_object(
    'ok', true,
    'message', v_bike.id || ' returned to ' || v_station.name || '. Ride duration: ' || v_duration || ' min.',
    'duration_min', v_duration
  );
end;
$$;

grant execute on function public.borrow_bike(text) to authenticated;
grant execute on function public.return_bike(text, text) to authenticated;
