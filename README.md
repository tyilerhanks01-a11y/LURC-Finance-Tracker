# UoL Riding Club — The Ledger

Finance tracker for the University of Liverpool Riding Club. React + Vite frontend, Supabase for auth/database, deployed on Vercel.

## Status

Code is complete and untested end-to-end (never run `npm install` / `npm run dev` yet, and no Supabase project exists yet). Nothing has been deployed. Three accounts already exist: GitHub, Supabase, Vercel — no projects created on any of them yet.

## What's built

- `src/App.jsx` — the whole app: Supabase email/password auth, an admin-approval flow (new signups start as `pending` and are invisible to data until approved), dashboard, add-transaction form, editable budget/categories, admin panel for approving/promoting/revoking/deleting users.
- `src/supabaseClient.js` — reads Supabase URL/key from env vars.
- `supabase-schema.sql` — full DB schema: `profiles`, `categories`, `transactions`, `settings` tables, RLS policies, a trigger that auto-creates a `pending` profile on signup, and the club's category budgets pre-seeded (Toll Costs £450, Lesson Subsidies £300, Competition Food £200, Venue Hire £150, Petrol/Mileage £200, Events & Social £100, Other £100; total £1500). Use this for a brand-new project.
- `supabase-migration-roles.sql` — one-time migration that adds the `normal`/`super_admin` roles to a project that was already set up from an earlier version of `supabase-schema.sql`.
- `supabase-migration-keepalive.sql` — one-time migration adding a `keep_alive_ping()` RPC so the GitHub Actions ping (below) can prove real connectivity without needing anon read access to `settings`.
- `.github/workflows/keep-alive.yml` — weekly ping to stop Supabase's free-tier 7-day inactivity pause. Needs `SUPABASE_URL` and `SUPABASE_ANON_KEY` added as GitHub repo secrets before it'll work.

### Roles

| Role | Can view data | Can add/edit transactions, budget, categories | Admin tab | Manage admins / delete profiles |
|---|---|---|---|---|
| `pending` | no | no | no | no |
| `viewer` | yes | no (read-only) | no | no |
| `normal` | yes | yes | no | no |
| `admin` | yes | yes | yes (manages pending/viewer/normal) | no |
| `super_admin` | yes | yes | yes (manages everyone) | yes — promote/demote admins, permanently delete any profile except their own |
| `removed` | no | no | no | no |

New signups start `pending`. An `admin` can approve them as `viewer` (read-only) or `normal` (can log transactions/edit budget), or revoke access. Only a `super_admin` can approve/promote someone to `admin` or `super_admin`, manage other admins' roles, or permanently delete a profile — this keeps regular admins from being able to touch or elevate into admin-level accounts.

## Remaining steps to go live

1. `npm install` and `npm run dev` locally to sanity-check the build.
2. Create the Supabase project, run `supabase-schema.sql` in its SQL editor.
3. Copy the Supabase project URL + anon key into `.env` (see `.env.example`) for local dev, and into Vercel's project env vars for production.
4. Sign up as the first user through the app, then in Supabase's Table Editor (or SQL Editor) manually set that one row's `role` to `super_admin` (see the comment at the bottom of `supabase-schema.sql`) — this is the one manual bootstrap step, after that all approvals happen in-app.
5. Push this repo to GitHub, connect it to Vercel, deploy.
6. Add `SUPABASE_URL` / `SUPABASE_ANON_KEY` as GitHub Actions secrets so the keep-alive workflow can run.
7. Approve real club members as they sign up, via the Admin tab.

## Design notes

Styling follows a "stable ledger" theme: navy (#1c2a44) on parchment (#f2ede1), Fraunces serif for headings, monospace for numbers/labels — matches an earlier Claude-built artifact version of this same tracker, don't restyle unless asked.
