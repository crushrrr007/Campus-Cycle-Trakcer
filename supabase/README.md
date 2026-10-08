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
| 4 | `migrations/004_ride_rpcs.sql` | Secure borrow/return RPCs |
| 5 | `migrations/005_public_stats.sql` | `public_stats()` RPC — anonymous aggregate counts for the sign-in page hero |

The files under `seed/` are optional demo fixtures, not production setup.
Create real users through the app rather than inserting into managed `auth.users`.

4. Use credentials from **your own Supabase project**, not a v0 Marketplace resource:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` (looks like `https://xxxx.supabase.co`)
   - **Publishable key** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Alternatively, use the legacy **anon key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Only set one public-key variable. Never use a service-role or secret key in a public variable.
5. In v0, enter these through the environment-variable form or project **Vars**.
   The existing `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` is supplied by v0; retain it.
   For local development, use `.env.example` as the template for `.env.local`.

## Required eight-digit email verification settings

Configure these in your personal project's Supabase Auth settings:

- Enable email authentication and **Confirm email**. Do not disable confirmation.
- Set **Email OTP length** to **8** (`mailer_otp_length: 8`). This is an Auth
  service setting, not an application environment variable or database migration.
- Set a suitable OTP expiration (for example, 600 seconds).
- In **Confirm signup**, replace link-only content with a code template such as:

  ```html
  <h2>Verify your CycleNet college email</h2>
  <p>Enter this 8-digit code in CycleNet:</p>
  <p><strong>{{ .Token }}</strong></p>
  <p>If you did not request this account, ignore this email.</p>
  ```

- Configure custom SMTP to deliver codes to actual `@nitt.edu` users. Supabase's
  default mail service restricts recipients and has low sending limits.
- Allow the application's `/auth/callback` URL and the existing v0 preview
  redirect URL if you retain confirmation-link callbacks.

Signup keeps the user on the eight-digit code screen. Supabase validates the
code via `verifyOtp({ email, token, type: "email" })` and issues the real session.
Resends use `auth.resend({ type: "signup", email })` with a 60-second UI cooldown;
Supabase also enforces server-side limits. Unconfirmed password sign-ins can
resume email verification and request a fresh signup code.

Public API credentials cannot change hosted Auth settings. Configure the OTP
length and template in your own account; the app cannot make six-digit emails
into eight-digit emails by changing the input alone.

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
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your publishable key>
```

The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also supported as an alternative.
Until the URL and a public key are set, authentication is disabled and protected
pages redirect to sign-in. Dummy cookies do not grant access.

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
