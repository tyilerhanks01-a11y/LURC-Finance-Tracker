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

-- Email every admin/super_admin (via Resend's API) whenever a new pending
-- signup shows up, so approvals don't sit unnoticed. Requires:
--   1. create extension if not exists pg_net;
--   2. Your Resend API key stored in Vault (run once, with your own key —
--      never commit a real key to source control):
--      select vault.create_secret('re_your_actual_api_key', 'resend_api_key');
create extension if not exists pg_net;

create function notify_pending_signup()
returns trigger as $$
declare
  admin_emails text[];
  resend_key text;
begin
  -- Everything below is best-effort: a broken notification (missing Vault,
  -- missing pg_net, Resend down, etc.) must never block someone signing up.
  begin
    select array_agg(email) into admin_emails from profiles where role in ('admin', 'super_admin') and email is not null;
    if admin_emails is null or array_length(admin_emails, 1) = 0 then
      return new;
    end if;

    select decrypted_secret into resend_key from vault.decrypted_secrets where name = 'resend_api_key';
    if resend_key is null then
      return new; -- vault secret not set up yet; skip silently rather than error
    end if;

    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || resend_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', 'The Ledger <noreply@lurcfinance.com>',
        'to', to_jsonb(admin_emails),
        'subject', 'New signup awaiting approval — LURC Finance Tracker',
        'html',
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f1c33;padding:32px 16px;">' ||
          '<tr><td align="center">' ||
          '<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#16264a;border:2px solid #f2ede1;">' ||
          '<tr><td style="padding:24px 32px;">' ||
          '<span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:3px;color:#c99a3e;text-transform:uppercase;font-weight:bold;">University of Liverpool &middot; Riding Club</span><br/>' ||
          '<span style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:900;color:#f2ede1;">The Ledger</span>' ||
          '</td></tr>' ||
          '<tr><td style="padding:0 32px 32px 32px;">' ||
          '<p style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#f2ede1;margin:0 0 16px 0;">New signup awaiting approval</p>' ||
          '<p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#c3cadb;margin:0 0 24px 0;">' || coalesce(new.email, 'Someone') || ' just signed up for The Ledger and needs approval before they can see club finances.</p>' ||
          '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#c99a3e;">' ||
          '<a href="https://lurcfinance.com" target="_blank" style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:2px;color:#12203f;text-decoration:none;text-transform:uppercase;">Review in Admin tab</a>' ||
          '</td></tr></table>' ||
          '</td></tr></table></td></tr></table>'
      )
    );
  exception when others then
    raise warning 'notify_pending_signup failed (signup still proceeds): %', sqlerrm;
  end;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_pending_signup_notify
  after insert on profiles
  for each row when (new.role = 'pending')
  execute procedure notify_pending_signup();

-- Categories (expenditure lines with a budget, or income sources with no budget)
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  budget numeric not null default 0,
  type text not null default 'expenditure' check (type in ('income', 'expenditure')),
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

-- Activity log: who edited what, plus a record of every keep-alive ping.
-- Only super admins can read it.
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null check (action in ('insert', 'update', 'delete', 'ping')),
  table_name text not null,
  record_id uuid,
  summary text,
  created_at timestamptz default now()
);
alter table activity_log enable row level security;
create policy "super admins read activity log" on activity_log for select using (is_super_admin());

create function log_transactions_activity()
returns trigger as $$
declare
  actor_em text;
begin
  select email into actor_em from profiles where id = auth.uid();
  if TG_OP = 'INSERT' then
    insert into activity_log (actor_id, actor_email, action, table_name, record_id, summary)
      values (auth.uid(), actor_em, 'insert', 'transactions', new.id, 'Added transaction: ' || new.description || ' (£' || new.amount || ')');
    return new;
  elsif TG_OP = 'UPDATE' then
    insert into activity_log (actor_id, actor_email, action, table_name, record_id, summary)
      values (auth.uid(), actor_em, 'update', 'transactions', new.id, 'Edited transaction: ' || new.description || ' (£' || new.amount || ')');
    return new;
  else
    insert into activity_log (actor_id, actor_email, action, table_name, record_id, summary)
      values (auth.uid(), actor_em, 'delete', 'transactions', old.id, 'Deleted transaction: ' || old.description || ' (£' || old.amount || ')');
    return old;
  end if;
end;
$$ language plpgsql security definer;

create trigger transactions_activity_log
  after insert or update or delete on transactions
  for each row execute procedure log_transactions_activity();

create function log_categories_activity()
returns trigger as $$
declare
  actor_em text;
begin
  select email into actor_em from profiles where id = auth.uid();
  if TG_OP = 'INSERT' then
    insert into activity_log (actor_id, actor_email, action, table_name, record_id, summary)
      values (auth.uid(), actor_em, 'insert', 'categories', new.id, 'Added category: ' || new.name || ' (budget £' || new.budget || ')');
    return new;
  elsif TG_OP = 'UPDATE' then
    insert into activity_log (actor_id, actor_email, action, table_name, record_id, summary)
      values (auth.uid(), actor_em, 'update', 'categories', new.id, 'Edited category: ' || new.name || ' (budget £' || new.budget || ')');
    return new;
  else
    insert into activity_log (actor_id, actor_email, action, table_name, record_id, summary)
      values (auth.uid(), actor_em, 'delete', 'categories', old.id, 'Deleted category: ' || old.name);
    return old;
  end if;
end;
$$ language plpgsql security definer;

create trigger categories_activity_log
  after insert or update or delete on categories
  for each row execute procedure log_categories_activity();

-- Health-check RPC for the GitHub Actions keep-alive ping — returns a constant,
-- no real data, so it's safe to expose to the anon key without touching RLS
-- on any table that actually holds club finances. Also logs the ping.
create function keep_alive_ping()
returns text as $$
begin
  insert into activity_log (action, table_name, summary)
    values ('ping', 'keep_alive', 'Keep-alive ping from GitHub Actions');
  return 'ok';
end;
$$ language plpgsql security definer;
grant execute on function keep_alive_ping() to anon;

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

-- Seed the default expenditure categories used by UoL Riding Club last year
insert into categories (name, budget, type) values
  ('Toll Costs', 450, 'expenditure'),
  ('Lesson Subsidies', 300, 'expenditure'),
  ('Competition Food', 200, 'expenditure'),
  ('Venue Hire', 150, 'expenditure'),
  ('Petrol / Mileage', 200, 'expenditure'),
  ('Events & Social', 100, 'expenditure'),
  ('Other', 100, 'expenditure');

-- Seed default income sources (no budget — these just categorise money coming in)
insert into categories (name, budget, type) values
  ('Memberships', 0, 'income'),
  ('Sponsorship', 0, 'income'),
  ('Fundraising', 0, 'income'),
  ('Other Income', 0, 'income');

-- IMPORTANT — one-time manual step after your own first signup:
-- Find your user id from the "profiles" table (Table Editor), then run:
-- update profiles set role = 'super_admin' where email = 'your-email@liverpool.ac.uk';
-- (super_admin so you can manage other admins later — see README for the full role hierarchy.)
