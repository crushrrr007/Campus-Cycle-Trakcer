# CycleNet — Supabase Database Setup

Everything needed to (re)create the CycleNet database on **any Supabase
project** — your own hosted supabase.com account (recommended) or a local
CLI stack. The scripts are plain SQL and portable.

## Setup on your own Supabase account (hosted)

1. Create a project at [supabase.com](https://supabase.com) (any org/region).
2. Open your project → **SQL Editor**.
3. Paste and run each file below **in order** (one at a time):

| # | File | What it does |
|---|------|--------------|
| 1 | `migrations/001_auth_and_profiles.sql` | `profiles` table (role: student/admin), @nitt.edu email enforcement trigger, auto-profile trigger, RLS |
| 2 | `migrations/002_app_schema.sql` | `stations`, `bikes`, `service_records`, `rides`, `issues`, `notifications` tables + RLS policies |
| 3 | `migrations/003_seed_app_data.sql` | Seeds the 10 campus stations and the bicycle fleet |
| 4 | `seed/004_test_users.sql` | Creates the dummy **test accounts** (admin + student) directly in `auth.users` — works in the hosted SQL Editor |
| 5 | `migrations/005_public_stats.sql` | `public_stats()` RPC — anonymous aggregate counts for the sign-in page hero |
| 6 | `seed/005_demo_data.sql` | **Demo/presentation data**: 8 extra students, ~320 rides over 30 days, active rides, issues, notifications |

4. Get your credentials: project → **Settings → API**:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` (looks like `https://xxxx.supabase.co`)
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Copy `.env.example` to `.env.local`, paste both values, restart the dev
   server. Real auth switches on automatically — no code changes needed.

> **Email confirmation:** the two seeded test accounts are pre-confirmed and
> log in immediately. New sign-ups through the app will receive a Supabase
> confirmation email by default. For testing you can disable this in
> **Authentication → Providers → Email → "Confirm email"** so new signups
> can log in instantly.

## Setup with the Supabase CLI (local, optional)

```bash
supabase start
supabase db reset            # applies ./supabase/migrations automatically
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" -f supabase/seed/004_test_users.sql
```

Or plain `psql` against any connection string:

```bash
psql "$DATABASE_URL" -f supabase/migrations/001_auth_and_profiles.sql
psql "$DATABASE_URL" -f supabase/migrations/002_app_schema.sql
psql "$DATABASE_URL" -f supabase/migrations/003_seed_app_data.sql
psql "$DATABASE_URL" -f supabase/seed/004_test_users.sql
```

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
```

Until these are set the app runs in **demo mode** (in-memory data, dummy
login with the same test credentials, role switch hidden while "signed in").

## Test credentials (dummy — for testing only)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@nitt.edu` | `Admin@1234` |
| Student | `106122045@nitt.edu` | `Student@1234` |

> Both are created by `seed/004_test_users.sql` with `email_confirmed_at`
> already set, so no email confirmation is needed. The script also sets all
> auth token columns to empty strings — required on hosted Supabase,
> otherwise login fails with "Database error querying schema".
>
> If direct `auth.users` inserts ever fail on a future Supabase version,
> just sign up through the app's `/sign-up` page instead, then promote the
> admin: `update public.profiles set role = 'admin' where email = 'admin@nitt.edu';`

## College email restriction

Registration is restricted to `@nitt.edu` addresses at **three** levels:

1. **UI** — the sign-up form validates the domain on every keystroke.
2. **App** — the submit handler hard-blocks non-nitt.edu addresses.
3. **Database** — a `before insert` trigger on `auth.users`
   (`enforce_nitt_email`) raises an exception for any other domain, so the
   rule holds even if someone calls the Supabase API directly.

## Roles

- Every new signup gets `role = 'student'` automatically (via the
  `handle_new_user` trigger). The role lives in `public.profiles`.
- Admins are promoted **only** via SQL (see the bottom of
  `seed/004_test_users.sql`):

  ```sql
  update public.profiles set role = 'admin' where email = 'someone@nitt.edu';
  ```

  Clients can never set their own role — RLS blocks updates to it.
