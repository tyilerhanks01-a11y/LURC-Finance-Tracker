-- One-time migration: adds a `type` column to categories so income can have
-- its own sources (Memberships, Sponsorship, ...) separate from expenditure
-- categories, and seeds a few defaults. Run this once in Supabase: Dashboard
-- > SQL Editor > New query > paste all > Run.

alter table categories add column type text not null default 'expenditure' check (type in ('income', 'expenditure'));

insert into categories (name, budget, type) values
  ('Memberships', 0, 'income'),
  ('Sponsorship', 0, 'income'),
  ('Fundraising', 0, 'income'),
  ('Other Income', 0, 'income');
