# UoL Riding Club — The Ledger

Finance tracker for the University of Liverpool Riding Club. React + Vite frontend, Supabase for auth/database, deployed on Vercel.

## Status

Code is complete and untested end-to-end (never run `npm install` / `npm run dev` yet, and no Supabase project exists yet). Nothing has been deployed. Three accounts already exist: GitHub, Supabase, Vercel — no projects created on any of them yet.

## What's built

- `src/App.jsx` — the whole app: Supabase email/password auth, an admin-approval flow (new signups start as `pending` and are invisible to data until an admin approves them as `viewer` or `admin`), dashboard, add-transaction form, editable budget/categories, admin panel for approving/promoting/revoking users.
- `src/supabaseClient.js` — reads Supabase URL/key from env vars.
- `supabase-schema.sql` — full DB schema: `profiles`, `categories`, `transactions`, `settings` tables, RLS policies, a trigger that auto-creates a `pending` profile on signup, and the club's category budgets pre-seeded (Toll Costs £450, Lesson Subsidies £300, Competition Food £200, Venue Hire £150, Petrol/Mileage £200, Events & Social £100, Other £100; total £1500).
- `.github/workflows/keep-alive.yml` — weekly ping to stop Supabase's free-tier 7-day inactivity pause. Needs `SUPABASE_URL` and `SUPABASE_ANON_KEY` added as GitHub repo secrets before it'll work.

## Remaining steps to go live

1. `npm install` and `npm run dev` locally to sanity-check the build.
2. Create the Supabase project, run `supabase-schema.sql` in its SQL editor.
3. Copy the Supabase project URL + anon key into `.env` (see `.env.example`) for local dev, and into Vercel's project env vars for production.
4. Sign up as the first user through the app, then in Supabase's Table Editor manually set that one row's `role` to `admin` (see the comment at the bottom of `supabase-schema.sql`) — this is the one manual bootstrap step, after that all approvals happen in-app.
5. Push this repo to GitHub, connect it to Vercel, deploy.
6. Add `SUPABASE_URL` / `SUPABASE_ANON_KEY` as GitHub Actions secrets so the keep-alive workflow can run.
7. Approve real club members as they sign up, via the Admin tab.

## Design notes

Styling follows a "stable ledger" theme: navy (#1c2a44) on parchment (#f2ede1), Fraunces serif for headings, monospace for numbers/labels — matches an earlier Claude-built artifact version of this same tracker, don't restyle unless asked.
