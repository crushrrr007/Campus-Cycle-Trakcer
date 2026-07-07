-- ============================================================================
-- CycleNet — 002: Application schema (stations, bikes, rides, issues, ...)
-- Run AFTER 001_auth_and_profiles.sql. Safe to re-run (idempotent).
-- ============================================================================

-- ── Enums ────────────────────────────────────────────────────────────────────
do $$ begin
  create type public.bike_status as enum ('available', 'in-use', 'maintenance');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ride_status as enum ('active', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.issue_category as enum ('brakes', 'tyres', 'chain', 'seat', 'dock', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.issue_status as enum ('open', 'in-review', 'resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_type as enum ('borrow', 'return', 'low-stock', 'full', 'maintenance', 'announcement');
exception when duplicate_object then null; end $$;

-- ── Stations ─────────────────────────────────────────────────────────────────
create table if not exists public.stations (
  id          text primary key,                 -- e.g. STN-LIB
  name        text not null,
  short_name  text not null,
  capacity    integer not null check (capacity >= 0),
  zone        text not null default '',
  lat         double precision not null,
  lng         double precision not null,
  map_x       integer not null default 0,       -- legacy SVG map coords
  map_y       integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── Bikes ────────────────────────────────────────────────────────────────────
create table if not exists public.bikes (
  id                text primary key,           -- e.g. NITT-0001
  qr                text not null unique,       -- QR payload, e.g. NITTBIKE:NITT-0001
  status            public.bike_status not null default 'available',
  station_id        text references public.stations (id) on delete set null,
  model             text not null default 'NITT Cruiser',
  condition         integer not null default 100 check (condition between 0 and 100),
  usage_count       integer not null default 0,
  last_service_date timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index if not exists bikes_station_idx on public.bikes (station_id);
create index if not exists bikes_status_idx on public.bikes (status);

-- ── Service records ──────────────────────────────────────────────────────────
create table if not exists public.service_records (
  id         uuid primary key default gen_random_uuid(),
  bike_id    text not null references public.bikes (id) on delete cascade,
  type       text not null,
  notes      text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists service_records_bike_idx on public.service_records (bike_id);

-- ── Rides ────────────────────────────────────────────────────────────────────
create table if not exists public.rides (
  id                uuid primary key default gen_random_uuid(),
  bike_id           text not null references public.bikes (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  source_station_id text not null references public.stations (id),
  dest_station_id   text references public.stations (id),
  borrow_time       timestamptz not null default now(),
  return_time       timestamptz,
  duration_min      integer,
  status            public.ride_status not null default 'active'
);

create index if not exists rides_user_idx on public.rides (user_id);
create index if not exists rides_bike_idx on public.rides (bike_id);
create index if not exists rides_status_idx on public.rides (status);

-- one active ride per user, one active ride per bike
create unique index if not exists rides_one_active_per_user
  on public.rides (user_id) where status = 'active';
create unique index if not exists rides_one_active_per_bike
  on public.rides (bike_id) where status = 'active';

-- ── Issue reports ─────────────────────────────────────────────────────────────
create table if not exists public.issues (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  bike_id     text references public.bikes (id) on delete set null,
  station_id  text references public.stations (id) on delete set null,
  category    public.issue_category not null,
  description text not null,
  status      public.issue_status not null default 'open',
  created_at  timestamptz not null default now()
);

create index if not exists issues_user_idx on public.issues (user_id);
create index if not exists issues_status_idx on public.issues (status);

-- ── Notifications ─────────────────────────────────────────────────────────────
-- user_id NULL = broadcast to everyone (announcements, station alerts).
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete cascade,
  type       public.notification_type not null,
  title      text not null,
  message    text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.stations        enable row level security;
alter table public.bikes           enable row level security;
alter table public.service_records enable row level security;
alter table public.rides           enable row level security;
alter table public.issues          enable row level security;
alter table public.notifications   enable row level security;

-- Stations: everyone signed-in can read; only admins mutate.
drop policy if exists "stations_select_all" on public.stations;
create policy "stations_select_all" on public.stations
  for select using (auth.uid() is not null);
drop policy if exists "stations_admin_write" on public.stations;
create policy "stations_admin_write" on public.stations
  for all using (public.is_admin()) with check (public.is_admin());

-- Bikes: everyone signed-in can read; only admins mutate directly.
-- (Borrow/return flows should go through security-definer RPCs or server code.)
drop policy if exists "bikes_select_all" on public.bikes;
create policy "bikes_select_all" on public.bikes
  for select using (auth.uid() is not null);
drop policy if exists "bikes_admin_write" on public.bikes;
create policy "bikes_admin_write" on public.bikes
  for all using (public.is_admin()) with check (public.is_admin());

-- Service records: readable by all signed-in; only admins write.
drop policy if exists "service_select_all" on public.service_records;
create policy "service_select_all" on public.service_records
  for select using (auth.uid() is not null);
drop policy if exists "service_admin_write" on public.service_records;
create policy "service_admin_write" on public.service_records
  for all using (public.is_admin()) with check (public.is_admin());

-- Rides: students see their own; admins see all. Students insert their own.
drop policy if exists "rides_select_own_or_admin" on public.rides;
create policy "rides_select_own_or_admin" on public.rides
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "rides_insert_own" on public.rides;
create policy "rides_insert_own" on public.rides
  for insert with check (auth.uid() = user_id);
drop policy if exists "rides_update_own_or_admin" on public.rides;
create policy "rides_update_own_or_admin" on public.rides
  for update using (auth.uid() = user_id or public.is_admin());

-- Issues: students see/insert their own; admins see and update all.
drop policy if exists "issues_select_own_or_admin" on public.issues;
create policy "issues_select_own_or_admin" on public.issues
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "issues_insert_own" on public.issues;
create policy "issues_insert_own" on public.issues
  for insert with check (auth.uid() = user_id);
drop policy if exists "issues_admin_update" on public.issues;
create policy "issues_admin_update" on public.issues
  for update using (public.is_admin()) with check (public.is_admin());

-- Notifications: users see their own + broadcasts; admins manage.
drop policy if exists "notifications_select_own_or_broadcast" on public.notifications;
create policy "notifications_select_own_or_broadcast" on public.notifications
  for select using (user_id is null or auth.uid() = user_id or public.is_admin());
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id);
drop policy if exists "notifications_admin_write" on public.notifications;
create policy "notifications_admin_write" on public.notifications
  for insert with check (public.is_admin());
