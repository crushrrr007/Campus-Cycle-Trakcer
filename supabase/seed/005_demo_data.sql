-- ============================================================================
-- CycleNet — 005: Rich DEMO data for presentation
-- Run AFTER all migrations and seed/004_test_users.sql. Safe to re-run
-- (every block is guarded so it only seeds once).
--
-- Adds:
--   • 8 extra demo student accounts  (1061220xx@nitt.edu / Student@1234)
--   • ~320 completed rides over the last 30 days (peak-hour weighted,
--     so the dashboard charts look realistic)
--   • 4 active rides right now (bikes marked in-use)
--   • 14 issue reports in mixed states
--   • Broadcast + personal notifications
--
-- NEVER run this against a production database.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── 1. Extra demo students ───────────────────────────────────────────────────
do $$
declare
  names text[] := array[
    'Diya Krishnan','Rohan Iyer','Ananya Reddy','Karthik Subramanian',
    'Meera Nair','Aditya Venkatesh','Shruti Raman','Vikram Pillai'
  ];
  depts text[] := array['ECE','MECH','CSE','EEE','CIVIL','PROD','ICE','MME'];
  em text;
  uid uuid;
  i int;
begin
  for i in 1..8 loop
    em := '1061220' || lpad((50 + i)::text, 2, '0') || '@nitt.edu';
    if not exists (select 1 from auth.users where email = em) then
      uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at,
        confirmation_token, recovery_token,
        email_change, email_change_token_new, email_change_token_current,
        phone_change, phone_change_token, reauthentication_token
      ) values (
        '00000000-0000-0000-0000-000000000000', uid,
        'authenticated', 'authenticated', em,
        crypt('Student@1234', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', names[i], 'department', depts[i]),
        now() - (i * 7 || ' days')::interval, now(),
        '', '',
        '', '', '',
        '', '', ''
      );
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), uid, uid::text,
        jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true),
        'email', now(), now(), now()
      );
    end if;
  end loop;
end $$;

-- Make sure the trigger-created profiles carry the names/departments
update public.profiles p
set full_name = u.raw_user_meta_data ->> 'full_name',
    department = u.raw_user_meta_data ->> 'department'
from auth.users u
where p.id = u.id
  and u.email like '1061220__@nitt.edu'
  and (p.full_name is null or p.full_name = '' or p.full_name = p.email);

-- ── 2. ~320 completed rides over the last 30 days ────────────────────────────
do $$
declare
  student_ids uuid[];
  station_ids text[] := array['STN-GATE','STN-LIB','STN-OCTAGON','STN-LECTURE','STN-RUBY',
                              'STN-ZIRCON','STN-GARNET','STN-MEGAMESS','STN-ARCH','STN-CSE'];
  -- Weighted hours: morning classes, lunch, and evening peaks
  hours int[] := array[7,8,8,8,9,9,9,10,10,11,12,12,13,13,13,14,14,15,16,17,17,18,18,18,18,19,19,20,21,22];
  uid uuid;
  src text; dst text;
  bike text;
  day_off int; hr int; mins int; dur int;
  bt timestamptz;
  i int;
begin
  select array_agg(id) into student_ids
  from public.profiles where role = 'student';

  if student_ids is null or array_length(student_ids, 1) = 0 then
    raise notice 'No student profiles found — run seed/004_test_users.sql first.';
    return;
  end if;

  -- Only seed once
  if (select count(*) from public.rides where status = 'completed') >= 50 then
    raise notice 'Demo rides already seeded — skipping.';
    return;
  end if;

  for i in 1..320 loop
    uid  := student_ids[1 + floor(random() * array_length(student_ids, 1))::int];
    src  := station_ids[1 + floor(random() * 10)::int];
    dst  := station_ids[1 + floor(random() * 10)::int];
    if dst = src then
      dst := station_ids[1 + (1 + floor(random() * 10)::int) % 10];
    end if;
    bike := 'NITT-' || lpad((1 + floor(random() * 112)::int)::text, 4, '0');

    -- Recent days get slightly more traffic
    day_off := least(floor(power(random(), 1.3) * 30)::int, 29);
    hr      := hours[1 + floor(random() * array_length(hours, 1))::int];
    mins    := floor(random() * 60)::int;
    dur     := 5 + floor(random() * 35)::int;

    bt := date_trunc('day', now()) - (day_off || ' days')::interval
          + (hr || ' hours')::interval + (mins || ' minutes')::interval;

    -- Keep rides in the past
    if bt > now() - interval '2 hours' then
      bt := bt - interval '1 day';
    end if;

    insert into public.rides (bike_id, user_id, source_station_id, dest_station_id,
                              borrow_time, return_time, duration_min, status)
    values (bike, uid, src, dst, bt, bt + (dur || ' minutes')::interval, dur, 'completed');
  end loop;

  -- Reflect the traffic in bike usage counters
  update public.bikes b
  set usage_count = b.usage_count + coalesce(r.cnt, 0)
  from (select bike_id, count(*)::int as cnt
        from public.rides where status = 'completed' group by bike_id) r
  where r.bike_id = b.id;

  raise notice 'Seeded 320 demo rides.';
end $$;

-- ── 3. A few ACTIVE rides right now ──────────────────────────────────────────
do $$
declare
  demo_students uuid[];
  free_bikes text[];
  station_ids text[] := array['STN-LIB','STN-OCTAGON','STN-RUBY','STN-MEGAMESS'];
  i int;
begin
  if exists (select 1 from public.rides where status = 'active') then
    raise notice 'Active rides already exist — skipping.';
    return;
  end if;

  -- Only demo students (NOT the main test student, so borrow testing stays free)
  select array_agg(id) into demo_students from (
    select id from public.profiles p
    where p.role = 'student' and p.email <> '106122045@nitt.edu'
    order by p.email limit 4
  ) s;

  select array_agg(id) into free_bikes from (
    select id from public.bikes
    where status = 'available'
      and not exists (select 1 from public.rides r where r.bike_id = bikes.id and r.status = 'active')
    order by id limit 4
  ) t;

  if demo_students is null or free_bikes is null then return; end if;

  for i in 1..least(array_length(demo_students, 1), array_length(free_bikes, 1), 4) loop
    insert into public.rides (bike_id, user_id, source_station_id,
                              borrow_time, status)
    values (free_bikes[i], demo_students[i], station_ids[i],
            now() - ((5 + i * 9) || ' minutes')::interval, 'active');

    update public.bikes set status = 'in-use', station_id = null
    where id = free_bikes[i];
  end loop;

  raise notice 'Seeded active rides.';
end $$;

-- ── 4. Issue reports in mixed states ─────────────────────────────────────────
do $$
declare
  student_ids uuid[];
  cats public.issue_category[] := array['brakes','tyres','chain','seat','dock','other']::public.issue_category[];
  descs text[] := array[
    'Front brake lever feels loose and needs adjustment.',
    'Rear tyre pressure drops overnight — possible slow puncture.',
    'Chain slips when pedalling uphill near the library.',
    'Seat clamp will not hold height, keeps sliding down.',
    'Dock 4 at this station does not release bikes on first scan.',
    'Bell is missing and the reflector is cracked.',
    'Handlebar grip is torn on the right side.',
    'Pedal bearing makes a clicking noise at speed.',
    'QR sticker is faded and hard to scan in sunlight.',
    'Gears will not shift into third on this bike.',
    'Kickstand spring is broken, stand drags on the ground.',
    'Basket mount is bent after a fall, needs replacement.',
    'Brake pads are worn thin and squeal loudly.',
    'Docking point light stays red even when free.'
  ];
  stns text[] := array['STN-GATE','STN-LIB','STN-OCTAGON','STN-LECTURE','STN-RUBY',
                       'STN-ZIRCON','STN-GARNET','STN-MEGAMESS','STN-ARCH','STN-CSE'];
  i int;
  st public.issue_status;
begin
  if (select count(*) from public.issues) >= 10 then
    raise notice 'Demo issues already seeded — skipping.';
    return;
  end if;

  select array_agg(id) into student_ids
  from public.profiles where role = 'student';
  if student_ids is null then return; end if;

  for i in 1..14 loop
    st := case when i <= 5 then 'open'
               when i <= 9 then 'in-review'
               else 'resolved' end::public.issue_status;

    insert into public.issues (user_id, bike_id, station_id, category, description, status, created_at)
    values (
      student_ids[1 + (i % array_length(student_ids, 1))],
      case when i % 4 = 0 then null else 'NITT-' || lpad(((i * 11) % 112 + 1)::text, 4, '0') end,
      case when i % 4 = 0 then stns[1 + (i % 10)] else null end,
      cats[1 + (i % 6)],
      descs[i],
      st,
      now() - ((i * 26) || ' hours')::interval
    );
  end loop;

  raise notice 'Seeded 14 demo issues.';
end $$;

-- ── 5. Notifications (broadcasts + personal) ─────────────────────────────────
do $$
declare
  student_id uuid;
begin
  if (select count(*) from public.notifications) >= 5 then
    raise notice 'Demo notifications already seeded — skipping.';
    return;
  end if;

  select id into student_id from public.profiles where email = '106122045@nitt.edu';

  -- Broadcasts (user_id NULL = everyone)
  insert into public.notifications (user_id, type, title, message, created_at) values
    (null, 'announcement', 'Monsoon riding advisory',
     'Light showers expected this week. Please use bikes with working brakes and park under covered docks.', now() - interval '4 hours'),
    (null, 'low-stock', 'Low availability at Main Gate',
     'Main Gate Station is running low on bikes. Nearest alternative: Architecture Block Station.', now() - interval '9 hours'),
    (null, 'maintenance', 'Fleet service drive this weekend',
     'Bikes due for service will be collected on Saturday morning. Availability may be briefly reduced.', now() - interval '1 day'),
    (null, 'full', 'Ruby Parking almost full',
     'Ruby Cycle Parking is at 90% capacity. Consider returning bikes at Zircon Hostels Station.', now() - interval '2 days'),
    (null, 'announcement', 'CycleNet crosses 300 rides this month!',
     'Thanks for riding green. Over 300 campus trips completed this month on CycleNet.', now() - interval '3 days');

  -- Personal notifications for the main test student
  if student_id is not null then
    insert into public.notifications (user_id, type, title, message, read, created_at) values
      (student_id, 'return', 'Ride completed',
       'You returned NITT-0002 at Architecture Block Station. Ride time: 12 min.', true, now() - interval '1 day'),
      (student_id, 'borrow', 'Bike checked out',
       'You borrowed NITT-0002 from Octagon Station. Enjoy your ride!', true, now() - interval '1 day' - interval '15 minutes');
  end if;

  raise notice 'Seeded demo notifications.';
end $$;
