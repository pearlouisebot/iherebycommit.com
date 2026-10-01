-- PROPOSED, NOT APPLIED. Apply with apply_migration name
-- "waitlist_confirmation_email_sent_at_grokbot" only when going live.
-- Nullable, no default: existing rows stay NULL (never emailed) and nothing is backfilled.
alter table public.waitlist
  add column if not exists confirmation_email_sent_at timestamptz;

comment on column public.waitlist.confirmation_email_sent_at is
  'When the one-time thank-you email was sent (claimed) by submit-application. NULL = not sent.';

-- Rollback:
-- alter table public.waitlist drop column if exists confirmation_email_sent_at;
