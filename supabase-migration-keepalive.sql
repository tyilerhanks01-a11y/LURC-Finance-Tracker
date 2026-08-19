-- One-time migration: adds a health-check RPC for the GitHub Actions keep-alive
-- ping, so it can prove real DB connectivity without needing read access to the
-- settings table (which stays gated behind approval like everything else).
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste all > Run.

create function keep_alive_ping()
returns text as $$
  select 'ok'::text;
$$ language sql security definer;
grant execute on function keep_alive_ping() to anon;
