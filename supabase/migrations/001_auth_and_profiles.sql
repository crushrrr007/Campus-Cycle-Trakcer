-- ============================================================================
-- CycleNet — 001: Auth setup, profiles, @nitt.edu enforcement
-- Run FIRST. Safe to re-run (idempotent).
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Roles ───────────────────────────────────────────────────────────────────
do $$ begin
  create type public.user_role as enum ('student', 'admin');
exception
  when duplicate_object then null;
end $$;

-- ── Profiles (public mirror of auth.users) ──────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  full_name   text not null default '',
  role        public.user_role not null default 'student',
  department  text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Enforce @nitt.edu at the database level ──────────────────────────────────
-- Even direct API calls cannot register a non-college email.
create or replace function public.enforce_nitt_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) not like '%@nitt.edu' then
    raise exception 'Registration is restricted to @nitt.edu email addresses (got %)', new.email
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_nitt_email_on_signup on auth.users;
create trigger enforce_nitt_email_on_signup
  before insert on auth.users
  for each row
  execute function public.enforce_nitt_email();

-- ── Auto-create a profile row on signup ─────────────────────────────────────
-- Every new user defaults to 'student'. Admins are promoted via SQL only.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, department)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'department', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ── updated_at maintenance ───────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ── Helper: is the current user an admin? ───────────────────────────────────
-- SECURITY DEFINER so RLS policies can call it without recursion.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  -- users may edit their profile but NEVER their own role
  with check (auth.uid() = id and role = (select p.role from public.profiles p where p.id = auth.uid()));

-- inserts happen only through the security-definer trigger, deletes cascade
-- from auth.users — no insert/delete policies needed for clients.
