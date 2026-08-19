-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste all > Run

-- Profiles table, one row per user, tracks approval status/role
create table profiles (
  id uuid references auth.users primary key,
  email text,
  role text not null default 'pending' check (role in ('pending', 'normal', 'viewer', 'admin', 'super_admin', 'removed')),
  created_at timestamptz default now()
);

-- Auto-create a pending profile whenever someone signs up
create function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  budget numeric not null default 0,
  created_at timestamptz default now()
);

-- Transactions
create table transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  description text not null,
  category text,
  type text not null check (type in ('Income', 'Expenditure')),
  amount numeric not null,
  paid_by text,
  logged_by text,
  created_at timestamptz default now()
);

-- Settings (single row holding the total budget)
create table settings (
  id int primary key default 1,
  total_budget numeric not null default 1500
);
insert into settings (id, total_budget) values (1, 1500);

-- Helper: is the current user approved to at least view the ledger?
-- (viewer = read-only, normal/admin/super_admin can also edit)
create function is_approved()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('normal', 'viewer', 'admin', 'super_admin')
  );
$$ language sql security definer;

-- Helper: can the current user add/edit transactions, categories, and budget?
create function is_editor()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('normal', 'admin', 'super_admin')
  );
$$ language sql security definer;

-- Helper: admin-tier (admin or super_admin) — approve members, delete transactions, see all profiles
create function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$ language sql security definer;

-- Helper: super_admin only — manage other admins, delete profiles outright
create function is_super_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$ language sql security definer;

-- Enable RLS everywhere
alter table profiles enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table settings enable row level security;

-- Profiles policies
create policy "users see own profile" on profiles for select using (auth.uid() = id);
create policy "admins see all profiles" on profiles for select using (is_admin());
-- Regular admins can only manage pending/normal/viewer/removed members, and can't
-- elevate anyone into admin/super_admin. Super admins can manage anyone (incl. other
-- admins) and can set/remove admin/super_admin roles.
create policy "manage profile roles" on profiles for update
  using (
    is_super_admin()
    or (is_admin() and role not in ('admin', 'super_admin'))
  )
  with check (
    is_super_admin()
    or (role not in ('admin', 'super_admin'))
  );
-- Super admins can permanently delete a profile (never their own, to avoid lockout)
create policy "super admins delete profiles" on profiles for delete using (is_super_admin() and id <> auth.uid());

-- Categories policies (read for anyone approved incl. normal/read-only; writes need editor+)
create policy "approved members read categories" on categories for select using (is_approved());
create policy "editors write categories" on categories for insert with check (is_editor());
create policy "editors update categories" on categories for update using (is_editor());
create policy "editors delete categories" on categories for delete using (is_editor());

-- Transactions policies
create policy "approved members read transactions" on transactions for select using (is_approved());
create policy "editors write transactions" on transactions for insert with check (is_editor());
create policy "admins delete transactions" on transactions for delete using (is_admin());

-- Settings policies
create policy "approved members read settings" on settings for select using (is_approved());
create policy "editors update settings" on settings for update using (is_editor());

-- Seed the default categories used by UoL Riding Club last year
insert into categories (name, budget) values
  ('Toll Costs', 450),
  ('Lesson Subsidies', 300),
  ('Competition Food', 200),
  ('Venue Hire', 150),
  ('Petrol / Mileage', 200),
  ('Events & Social', 100),
  ('Other', 100);

-- IMPORTANT — one-time manual step after your own first signup:
-- Find your user id from the "profiles" table (Table Editor), then run:
-- update profiles set role = 'super_admin' where email = 'your-email@liverpool.ac.uk';
-- (super_admin so you can manage other admins later — see README for the full role hierarchy.)
