# CycleNet — Campus Cycle Tracker

A bicycle-sharing and management web app for **NIT Trichy**. Students can find campus stations, borrow and return bicycles, review their rides, report issues, and submit bicycle donations. Administrators manage the fleet, stations, issue reports, and donation assessments.

> This repository includes the application and core Supabase setup scripts. It is not a production-readiness certification: review the deployment checklist and current limitations before publishing.

## Features

### Students

- College-email registration, eight-digit email verification, and password sign-in.
- Password recovery and authenticated password changes using emailed codes.
- Interactive campus map with station availability, frame-type filters, and nearest-station discovery.
- QR-camera scanning or manual bicycle-code entry to borrow a bicycle.
- Return a bicycle to a station with available dock capacity.
- Ride history, issue reporting, notifications, and bicycle-donation submissions with ownership proof.

### Administrators

- Fleet management, bicycle details, service records, and station management.
- Issue triage and donation review, including ownership and safety assessments.
- Dashboard charts, station analytics, ride history, and CSV exports.

The interface supports desktop and mobile layouts, light and dark themes, and loading/error states for database-backed views.

**Tracking scope:** the map shows station availability, not live bicycle GPS positions. Core station, bicycle, and ride data refresh through SWR polling every 15 seconds and on window focus; this is not a continuous telemetry feed. Borrowing and returning record software checkouts—they do not control physical dock locks.

## Tech stack

| Layer | Technology |
| --- | --- |
| Application | Next.js 16 App Router, React 19, TypeScript |
| Styling and components | Tailwind CSS 4, shadcn/ui, Base UI, Lucide |
| Authentication and database | Supabase Auth, PostgreSQL, Row Level Security |
| Client data synchronization | SWR |
| Mapping | Leaflet, React Leaflet, OpenStreetMap tiles |
| Charts | Recharts |
| QR codes | `qrcode`, `jsqr` |
| Tests | Node.js test runner |
| Package manager | pnpm 10.34.3 |

## Getting started

Use the GitHub repository for a local checkout. You will need Node.js 22 or newer, pnpm **10.34.3**, and a Supabase project.

```bash
git clone https://github.com/crushrrr007/Campus-Cycle-Trakcer.git
cd Campus-Cycle-Trakcer
pnpm install --frozen-lockfile
```

### 1. Configure environment variables

Create an untracked `.env.local` using [`.env.example`](.env.example) as the template:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

- A legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` can be used **instead of** the publishable-key variable.
- These public credentials belong to the browser; data access must be protected by database policies. Never put a service-role key, secret key, or database password in a `NEXT_PUBLIC_` variable.
- In v0, use **Project Settings → Vars** rather than a terminal. Retain `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` when v0 supplies it for preview callbacks.
- Do not commit environment files or credentials.

Without a valid Supabase URL and public key, authentication is unavailable and protected routes redirect to sign-in. Internal demo state does not provide a usable authenticated backend.

### 2. Set up the database

Follow the detailed [Supabase setup guide](supabase/README.md). Apply the core SQL files in this order to the intended database:

1. [`001_auth_and_profiles.sql`](supabase/migrations/001_auth_and_profiles.sql) — profiles, college-email restriction, roles, and profile policies.
2. [`002_app_schema.sql`](supabase/migrations/002_app_schema.sql) — stations, bicycles, service records, rides, issues, and notifications.
3. [`003_seed_app_data.sql`](supabase/migrations/003_seed_app_data.sql) — initial campus stations and fleet data; review these records before using them in a real deployment.
4. [`004_ride_rpcs.sql`](supabase/migrations/004_ride_rpcs.sql) — borrow and return functions.
5. [`005_public_stats.sql`](supabase/migrations/005_public_stats.sql) — aggregate statistics for the authentication page.

**Donation setup is incomplete in the checked-in migrations.** The application also requires `public.donations`, `public.donation_proofs`, and the `submit_cycle_donation` RPC, plus their access policies and review-timestamp behavior. The five core scripts do not create these objects. A fresh database will not support donations until the corresponding schema is provisioned; document and version that setup before treating a new deployment as complete.

The scripts in [`supabase/seed/`](supabase/seed/) are optional development fixtures, not production prerequisites. They include fixed test-account credentials. **Do not run them against production.** If those accounts already exist in a deployment, disable them or rotate their credentials and revoke their sessions.

### 3. Configure Supabase Auth

The email flows require configuration outside the application:

- Enable email/password authentication and email confirmation.
- Set email OTP length to **8**. The application expects eight-digit signup and recovery codes.
- Configure the confirmation email template to include `{{ .Token }}`.
- Use [`supabase/templates/recovery.html`](supabase/templates/recovery.html) as the recovery-email template.
- Configure SMTP capable of delivering mail to real `@nitt.edu` recipients; the default mail service has delivery restrictions and low limits.
- Configure the deployed site URL and allowed `/auth/callback` URLs, including the v0 redirect URL when applicable.

New users receive the `student` role. Administrator access is assigned through trusted database administration, as described in the [setup guide](supabase/README.md); it is not selected during registration.

### 4. Start local development

```bash
pnpm dev
```

Open `http://localhost:3000`. Register with a real `@nitt.edu` email and confirm the emailed code before using protected features.

Camera scanning and location discovery require browser permission and a secure context (HTTPS or localhost). Manual bicycle-code entry and station browsing remain available without those permissions.

## Main routes

| Route | Purpose |
| --- | --- |
| `/sign-in`, `/sign-up`, `/forgot-password` | Authentication and account recovery |
| `/map` | Campus map and station availability |
| `/dashboard` | Role-specific dashboard |
| `/scan` | Borrow and return bicycles |
| `/rides` | Ride history |
| `/report` | Submit an issue |
| `/donate` | Student donation submissions |
| `/profile`, `/change-password` | Account information and password changes |
| `/bikes`, `/stations` | Administrator fleet and station management |
| `/issues`, `/reports`, `/donations` | Administrator issue triage, analytics, and donation review |

Donation API handlers live under `/api/donations`; password requests use `/auth/password`, and confirmation-link callbacks use `/auth/callback`.

## Repository structure

```text
app/                 App Router pages, layouts, and API handlers
components/          Feature-specific views and shared UI components
lib/                 Domain logic, SWR-backed state, and Supabase helpers
public/              Static assets
supabase/migrations/ Core SQL setup scripts
supabase/seed/       Optional development fixtures
supabase/templates/ Authentication email templates
supabase/README.md   Detailed database and authentication setup
tests/               Node.js tests
```

## Checks and production build

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

Run `pnpm start` after a successful build. Tests cover bicycle-frame availability, station navigation, donation validation/routes, and password-route behavior. They are not a substitute for authenticated browser testing, live RLS verification, or concurrency tests.

## Deployment and release checklist

Deploy from GitHub through Vercel, or use **Publish** in v0. Configure the same Supabase environment variables for each deployment environment and update the Auth site/redirect URLs for the final domain.

Before releasing:

- Resolve the existing security-review findings; this README does not fix application or database behavior.
- Remove production test accounts and revoke sessions associated with published credentials.
- Restrict direct ride-table mutations so clients cannot bypass validated borrow/return logic, and verify concurrent station-capacity handling.
- Verify actual sign-out, session expiry, student/admin authorization, and API authentication errors in the browser.
- Protect CSV exports against spreadsheet formula injection and malformed cells.
- Run `pnpm audit --prod` and update vulnerable dependencies; the currently pinned Next.js version requires review before production use.
- Provision and version the missing donation schema, and verify ownership proofs are accessible only to their submitter and authorized reviewers.
- Run tests, lint, type checks, and a production build, then exercise signup, email delivery, borrowing, returning, and administrative workflows against the intended database.

OpenStreetMap tiles and outbound email are external dependencies. Review their usage limits and configure appropriate production services for the expected campus traffic.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Protected pages redirect to sign-in | Supabase URL/public key, confirmed college email, and a valid session |
| Email code does not arrive or has the wrong length | SMTP delivery, eight-digit OTP setting, and email templates |
| Station or fleet views are empty | Core database scripts, RLS policies, and seeded/real fleet records |
| Donation storage errors on a fresh database | Missing donation tables, RPC, policies, or review timestamp setup |
| Camera or location is unavailable | HTTPS/localhost, browser permissions, or use manual entry/browsing |
| Preview callback goes to the wrong host | Auth redirect allowlist and v0's supplied redirect variable |

For v0 projects, check **Vars** and the preview's error output instead of changing credentials in source code.

## Contributing

Use a feature branch and pull request. Keep dependency manifests and the pnpm lockfile together, include tests for changed behavior, and document required database/Auth configuration changes. Never commit private credentials or real user data.

No license file is currently included; do not assume the repository grants permission for unrestricted reuse.
