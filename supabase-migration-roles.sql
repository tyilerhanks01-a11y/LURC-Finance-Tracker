-- One-time migration: adds "normal" (regular editing member) and "super_admin"
-- (elevated admin) roles, and repurposes "viewer" as read-only, on an existing
-- project that was set up with the original supabase-schema.sql.
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste all > Run.
--
-- NOTE: if you already approved any real members as "viewer" under the old
-- schema, they had edit rights before and will become read-only after this
-- runs. Re-approve them as "normal" from the Admin tab if they should keep
-- editing. (Not a concern if the only account so far is your own.)

-- 1. Expand the allowed roles
alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('pending', 'normal', 'viewer', 'admin', 'super_admin', 'removed'));

-- 2. Redefine helper functions for the 4-tier hierarchy
create or replace function is_approved()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('normal', 'viewer', 'admin', 'super_admin')
  );
$$ language sql security definer;

create or replace function is_editor()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('normal', 'admin', 'super_admin')
  );
$$ language sql security definer;

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$ language sql security definer;

create or replace function is_super_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$ language sql security definer;

-- 3. Swap write policies from is_approved() to is_editor() so "normal" stays read-only
drop policy "approved members write categories" on categories;
drop policy "approved members update categories" on categories;
drop policy "approved members delete categories" on categories;
create policy "editors write categories" on categories for insert with check (is_editor());
create policy "editors update categories" on categories for update using (is_editor());
create policy "editors delete categories" on categories for delete using (is_editor());

drop policy "approved members write transactions" on transactions;
create policy "editors write transactions" on transactions for insert with check (is_editor());

drop policy "approved members update settings" on settings;
create policy "editors update settings" on settings for update using (is_editor());

-- 4. Refine profile management: regular admins manage pending/normal/viewer/removed only;
--    only super_admins can touch admin/super_admin rows or elevate anyone into them
drop policy "admins update roles" on profiles;
create policy "manage profile roles" on profiles for update
  using (
    is_super_admin()
    or (is_admin() and role not in ('admin', 'super_admin'))
  )
  with check (
    is_super_admin()
    or (role not in ('admin', 'super_admin'))
  );

-- 5. Super admins can permanently delete a profile (never their own)
create policy "super admins delete profiles" on profiles for delete
  using (is_super_admin() and id <> auth.uid());

-- 6. Promote yourself from admin to super_admin so you can manage other admins.
--    Uncomment and run with your own email:
-- update profiles set role = 'super_admin' where email = 'your-email@liverpool.ac.uk';
