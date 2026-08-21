-- One-time migration: emails a user (via Resend's API) the moment an admin
-- approves them out of "pending". Reuses the same Vault secret as
-- supabase-migration-signup-notifications.sql — if you've already run that
-- one, the vault.create_secret step below is already done, skip it.
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste all > Run.
--
-- If you haven't already set up the Resend API key in Vault, do that first
-- (with your own real key — never commit a real key to source control):
--
--   select vault.create_secret('re_your_actual_api_key', 'resend_api_key');

create extension if not exists pg_net;

create or replace function notify_user_approved()
returns trigger as $$
declare
  resend_key text;
begin
  -- Best-effort: a broken notification must never block an admin's approval action.
  begin
    if new.email is null then
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
        'to', jsonb_build_array(new.email),
        'subject', 'LURC Finance Tracker: You have been approved',
        'text', 'You have been approved' || chr(10) || chr(10) || 'Your account has been approved as ' || upper(replace(new.role, '_', ' ')) || '. You can now log in and see club finances.' || chr(10) || chr(10) || 'Log in at https://lurcfinance.com',
        'html',
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f1c33;padding:32px 16px;">' ||
          '<tr><td align="center">' ||
          '<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#16264a;border:2px solid #f2ede1;">' ||
          '<tr><td style="padding:24px 32px;">' ||
          '<span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:3px;color:#c99a3e;text-transform:uppercase;font-weight:bold;">University of Liverpool &middot; Riding Club</span><br/>' ||
          '<span style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:900;color:#f2ede1;">The Ledger</span>' ||
          '</td></tr>' ||
          '<tr><td style="padding:0 32px 32px 32px;">' ||
          '<p style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#f2ede1;margin:0 0 16px 0;">You have been approved</p>' ||
          '<p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#c3cadb;margin:0 0 24px 0;">Your account has been approved as <strong style="color:#f2ede1;">' || upper(replace(new.role, '_', ' ')) || '</strong>. You can now log in and see club finances.</p>' ||
          '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#c99a3e;">' ||
          '<a href="https://lurcfinance.com" target="_blank" style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:2px;color:#12203f;text-decoration:none;text-transform:uppercase;">Log in to The Ledger</a>' ||
          '</td></tr></table>' ||
          '</td></tr></table></td></tr></table>'
      )
    );
  exception when others then
    raise warning 'notify_user_approved failed: %', sqlerrm;
  end;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_user_approved_notify on profiles;
create trigger on_user_approved_notify
  after update on profiles
  for each row when (old.role = 'pending' and new.role <> 'pending' and new.role <> 'removed')
  execute procedure notify_user_approved();
