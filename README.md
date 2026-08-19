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
- `supabase-migration-activity-log.sql` — one-time migration adding an `activity_log` table + triggers that record every transaction/category insert/update/delete (who did it and what) and every keep-alive ping. Visible to super admins only, via an ACTIVITY LOG panel at the bottom of the Admin tab.
- `supabase-migration-income-sources.sql` — one-time migration adding a `type` column (`income`/`expenditure`) to `categories`, so income can be broken down by source (Memberships, Sponsorship, ...) separately from expenditure categories. **Editing categories/budget in the Budget tab will silently fail until this is run**, since the app now always writes a `type` value.
- `supabase-migration-signup-notifications.sql` — one-time migration that emails every admin/super_admin (via Resend's API, straight from a Postgres trigger — no Edge Function needed) whenever someone new signs up. Requires a Resend API key stored in Supabase Vault first; see the comment at the top of the file for the exact command.
- `email-templates/confirm-signup.html` — branded HTML to paste into Supabase Dashboard > Authentication > Email Templates > Confirm signup, so signup confirmation emails match the site instead of Supabase's generic default.
- `email-templates/reset-password.html` — same idea, for Authentication > Email Templates > Reset Password. Requires `/reset-password` to be in the Redirect URLs allow-list (Authentication > URL Configuration).
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

Styling matches the LURC crest branding: deep navy background, gold (#c99a3e) accent used sparingly for kickers/primary actions, white/parchment text, bold Archivo for headings and body. Tokens live in `src/theme.js` — change colors there rather than hardcoding hex values in components. `email-templates/confirm-signup.html` mirrors the same palette but with web-safe font fallbacks (email clients ignore custom fonts). Don't restyle unless asked.
