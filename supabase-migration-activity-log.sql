-- One-time migration: adds an activity_log table (visible only to super admins)
-- that records every insert/update/delete on transactions and categories, plus
-- every keep-alive ping. Run this once in Supabase: Dashboard > SQL Editor >
-- New query > paste all > Run.

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

-- Replace keep_alive_ping so it also writes a log entry each time it's called
create or replace function keep_alive_ping()
returns text as $$
begin
  insert into activity_log (action, table_name, summary)
    values ('ping', 'keep_alive', 'Keep-alive ping from GitHub Actions');
  return 'ok';
end;
$$ language plpgsql security definer;
grant execute on function keep_alive_ping() to anon;
