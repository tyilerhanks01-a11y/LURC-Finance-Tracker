-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste all > Run

-- Profiles table, one row per user, tracks approval status/role
create table profiles (
  id uuid references auth.users primary key,
  email text,
  role text not null default 'pending' check (role in ('pending', 'viewer', 'admin', 'removed')),
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

-- Helper: is the current user an approved member?
create function is_approved()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('viewer', 'admin')
  );
$$ language sql security definer;

create function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
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
create policy "admins update roles" on profiles for update using (is_admin());

-- Categories policies
create policy "approved members read categories" on categories for select using (is_approved());
create policy "approved members write categories" on categories for insert with check (is_approved());
create policy "approved members update categories" on categories for update using (is_approved());
create policy "approved members delete categories" on categories for delete using (is_approved());

-- Transactions policies
create policy "approved members read transactions" on transactions for select using (is_approved());
create policy "approved members write transactions" on transactions for insert with check (is_approved());
create policy "admins delete transactions" on transactions for delete using (is_admin());

-- Settings policies
create policy "approved members read settings" on settings for select using (is_approved());
create policy "approved members update settings" on settings for update using (is_approved());

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
-- update profiles set role = 'admin' where email = 'your-email@liverpool.ac.uk';
