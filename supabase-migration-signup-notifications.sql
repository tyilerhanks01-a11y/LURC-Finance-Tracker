-- One-time migration: emails every admin/super_admin (via Resend's API)
-- whenever a new pending signup shows up, so approvals don't sit unnoticed.
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste all > Run.
--
-- BEFORE running the trigger/function below, store your Resend API key in
-- Supabase's encrypted Vault — run this separately, on its own, with your
-- real key (never commit a real key to source control):
--
--   select vault.create_secret('re_your_actual_api_key', 'resend_api_key');
--
-- Get an API key at https://resend.com/api-keys if you don't have one handy
-- (the same Resend account/domain used for the confirmation emails works).

create extension if not exists pg_net;

create or replace function notify_pending_signup()
returns trigger as $$
declare
  admin_emails text[];
  resend_key text;
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

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_pending_signup_notify on profiles;
create trigger on_pending_signup_notify
  after insert on profiles
  for each row when (new.role = 'pending')
  execute procedure notify_pending_signup();
