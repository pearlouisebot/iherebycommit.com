# Thank-you email after application (grokbot)

Status (2026-10-01 ~1:56 PM PT): DEPLOYED as submit-application v46 (byte-identical to this branch; v45 was a
secrets-only version bump of v44 code). Column added (migration waitlist_confirmation_email_sent_at_grokbot).
THANK_YOU_EMAIL_MODE=test_only. Rollback = redeploy the v44 snapshot (commit 0798701).
Verified: test path sent (Resend id 01a0f940-e6cd-7e1c-9ca0-cceb98f67e9f, row stamped); plain example.com skipped.

Files
- functions/_shared/thankYouEmail_grokbot.ts: copy (subject/text/HTML), recipient rules, Resend send with claim/release
- functions/_shared/thankYouEmail_grokbot_test.ts: `deno test` (8 tests)
- functions/submit-application/index.ts: v44 + one non-blocking EdgeRuntime.waitUntil call after the insert/consents
- migrations_proposed_grokbot/20261001_waitlist_confirmation_email_sent_at_grokbot.sql: nullable timestamptz column (not applied)

Behaviour
- THANK_YOU_EMAIL_MODE: off (default) | test_only | live
- Sends once per waitlist row (atomic NULL -> now() claim on confirmation_email_sent_at; released if the send fails)
- No column yet => the claim errors => nothing is sent (safe to deploy before the migration)
- @example.com is skipped, except THANK_YOU_EMAIL_TEST_TRIGGER (default qa+grokbot-email@example.com),
  which is delivered to THANK_YOU_EMAIL_TEST_INBOX (default delivered@resend.dev)
- A failed or slow email never changes the application response

Go live
1. Resend account; add domain iherebycommit.com (region us-east-1); add its DNS records in Cloudflare
   (DKIM TXT resend._domainkey, SPF TXT + MX on the `send` subdomain). Verify in Resend.
2. Make hello@iherebycommit.com receive mail (replies go there): e.g. Cloudflare Email Routing -> a monitored inbox.
3. Supabase secrets: RESEND_API_KEY=..., THANK_YOU_EMAIL_MODE=test_only
4. apply_migration waitlist_confirmation_email_sent_at_grokbot (the SQL file above)
5. Deploy submit-application (v45) with these files; rollback = redeploy v44 (baseline commit on this branch)
6. Submit the site form as qa+grokbot-email@example.com; check Resend logs + the row's confirmation_email_sent_at.
   Optionally set THANK_YOU_EMAIL_TEST_INBOX to a real inbox to eyeball rendering.
7. Approved? Set THANK_YOU_EMAIL_MODE=live (no redeploy needed). Existing rows are not backfilled.
