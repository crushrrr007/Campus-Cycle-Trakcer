-- ============================================================================
-- CycleNet — 004: Dummy TEST accounts (for testing only!)
-- Works on HOSTED Supabase (run in the SQL Editor) and local instances.
-- Run AFTER all migrations. Safe to re-run.
--
--   Admin   : admin@nitt.edu      / Admin@1234
--   Student : 106122045@nitt.edu  / Student@1234
--
-- Both accounts are created with email already confirmed so you can sign in
-- immediately. NEVER run this against a production database.
--
-- ALTERNATIVE (if direct auth.users inserts ever break on a future Supabase
-- version): sign the accounts up normally through the app's /sign-up page,
-- then promote the admin with:
--   update public.profiles set role = 'admin' where email = 'admin@nitt.edu';
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Test STUDENT: 106122045@nitt.edu / Student@1234 ──────────────────────────
do $$
declare
  uid uuid := gen_random_uuid();
begin
  if not exists (select 1 from auth.users where email = '106122045@nitt.edu') then
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      -- Token columns MUST be empty strings (not NULL) on hosted Supabase,
      -- otherwise GoTrue fails with "Database error querying schema" at login.
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', uid,
      'authenticated', 'authenticated', '106122045@nitt.edu',
      crypt('Student@1234', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Aarav Sharma","department":"CSE"}',
      now(), now(),
      '', '',
      '', '', '',
      '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', '106122045@nitt.edu', 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;
end $$;

-- ── Test ADMIN: admin@nitt.edu / Admin@1234 ──────────────────────────────────
do $$
declare
  uid uuid := gen_random_uuid();
begin
  if not exists (select 1 from auth.users where email = 'admin@nitt.edu') then
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      -- Token columns MUST be empty strings (not NULL) on hosted Supabase,
      -- otherwise GoTrue fails with "Database error querying schema" at login.
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', uid,
      'authenticated', 'authenticated', 'admin@nitt.edu',
      crypt('Admin@1234', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Dr. Priya Menon","department":"Transport Office"}',
      now(), now(),
      '', '',
      '', '', '',
      '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', 'admin@nitt.edu', 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;
end $$;

-- ── Promote the admin account (profiles row is auto-created by trigger) ──────
update public.profiles
set role = 'admin', department = 'Transport Office', full_name = 'Dr. Priya Menon'
where email = 'admin@nitt.edu';

-- Ensure the student profile has its details too
update public.profiles
set department = 'CSE', full_name = 'Aarav Sharma'
where email = '106122045@nitt.edu';
