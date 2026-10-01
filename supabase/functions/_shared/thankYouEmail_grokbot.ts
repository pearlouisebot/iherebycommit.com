/**
 * Thank-you email sent after a successful application (submit-application).
 *
 * Safe by default. Nothing is sent unless THANK_YOU_EMAIL_MODE is set:
 *   off (default / unset)  nothing is sent
 *   test_only              only the QA test path sends (see below)
 *   live                   real applicants + the QA test path
 *
 * Other rules:
 * - Non-blocking: callers schedule it with EdgeRuntime.waitUntil and never await it
 *   before responding. Every error is caught and logged; the application never fails.
 * - Idempotent: a row is claimed by setting waitlist.confirmation_email_sent_at from NULL
 *   to now() in one UPDATE. Only the request that wins the claim sends. If the column does
 *   not exist yet, the claim errors and nothing is sent. If the send fails, the claim is
 *   released (set back to NULL) so a later backfill can retry. Resend also gets an
 *   Idempotency-Key of thank-you/<waitlist id>.
 * - QA: every @example.com address is skipped, except the one address in
 *   THANK_YOU_EMAIL_TEST_TRIGGER (default qa+grokbot-email@example.com). That address is
 *   sent to THANK_YOU_EMAIL_TEST_INBOX (default delivered@resend.dev, Resend's test
 *   inbox), because example.com can't receive mail.
 * - The copy promises no acceptance, study participation or compensation.
 *
 * Secrets / env:
 *   RESEND_API_KEY                required to send (nothing is sent without it)
 *   THANK_YOU_EMAIL_MODE          off | test_only | live (default off)
 *   THANK_YOU_EMAIL_FROM          default "IHereByCommit <hello@iherebycommit.com>"
 *   THANK_YOU_EMAIL_REPLY_TO      default hello@iherebycommit.com
 *   THANK_YOU_EMAIL_TEST_TRIGGER  default qa+grokbot-email@example.com
 *   THANK_YOU_EMAIL_TEST_INBOX    default delivered@resend.dev
 */

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

export type ThankYouMode = "off" | "test_only" | "live";

export const DEFAULT_FROM = "IHereByCommit <hello@iherebycommit.com>";
export const DEFAULT_REPLY_TO = "hello@iherebycommit.com";
export const DEFAULT_TEST_TRIGGER = "qa+grokbot-email@example.com";
export const DEFAULT_TEST_INBOX = "delivered@resend.dev";
export const SUBJECT = "Thanks for applying to the IHereByCommit founding cohort";

const SEND_TIMEOUT_MS = 8000;

export function parseMode(raw: string | undefined): ThankYouMode {
  const v = (raw || "").trim().toLowerCase();
  return v === "live" || v === "test_only" ? v : "off";
}

/** Where to send, or null to skip. Pure, so it can be unit-tested. */
export function resolveRecipient(
  email: string,
  mode: ThankYouMode,
  testTrigger = DEFAULT_TEST_TRIGGER,
  testInbox = DEFAULT_TEST_INBOX,
): { to: string; isTest: boolean } | null {
  const e = (email || "").trim().toLowerCase();
  if (!e || mode === "off") return null;
  if (e === testTrigger.trim().toLowerCase()) return { to: testInbox, isTest: true };
  if (mode !== "live") return null;
  // QA rows: example.com (and its subdomains) never get mail.
  const domain = e.split("@")[1] || "";
  if (domain === "example.com" || domain.endsWith(".example.com")) return null;
  return { to: e, isTest: false };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** First name for the greeting: trimmed, single line, capped. Empty -> null. */
export function cleanFirstName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return v || null;
}

export function buildThankYouEmail(firstNameRaw: unknown): { subject: string; text: string; html: string } {
  const firstName = cleanFirstName(firstNameRaw);
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const greetingHtml = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi there,";

  const text = [
    greeting,
    "",
    "Thank you for applying to be part of the founding cohort of IHereByCommit.",
    "",
    "Your application is in. There's nothing else you need to do right now.",
    "",
    "We'll be in touch by text, at the phone number you gave us.",
    "",
    "Questions, or something in your application changed? Just reply to this email.",
    "",
    "Thanks again for raising your hand.",
    "",
    "The IHereByCommit team",
    "https://iherebycommit.com",
    "",
    "--",
    "You're getting this one-time email because you applied at iherebycommit.com.",
  ].join("\n");

  const display = "'Bebas Neue','Arial Narrow','Helvetica Neue',Impact,Arial,sans-serif";
  const mono = "'Space Mono','Courier New',Courier,monospace";
  const p = `margin:0 0 18px 0;font-family:${mono};font-size:15px;line-height:1.6;color:#f0ece0;`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(SUBJECT)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: dark; supported-color-schemes: dark; }
  body { margin:0; padding:0; background:#0e0e0e; }
  a { color:#c8f135; }
  @media (max-width:600px) { .wrap { padding:28px 20px !important; } .wm { font-size:34px !important; } }
</style>
</head>
<body style="margin:0;padding:0;background:#0e0e0e;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0e0e0e;">Your application is in. We'll be in touch by text.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0e0e0e" style="background:#0e0e0e;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0e0e0e" style="max-width:560px;background:#0e0e0e;border:1px solid #333333;border-radius:4px;">
      <tr><td class="wrap" style="padding:40px 40px 32px 40px;">
        <div class="wm" style="font-family:${display};font-size:44px;line-height:1;letter-spacing:0.06em;color:#f0ece0;">I HEREBY <span style="color:#c8f135;">COMMIT</span></div>
        <div style="height:3px;line-height:3px;font-size:0;background:#c8f135;margin:4px 0 32px 0;">&nbsp;</div>
        <p style="margin:0 0 10px 0;font-family:${mono};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#c8f135;">Application received</p>
        <h1 style="margin:0 0 24px 0;font-family:${display};font-weight:normal;font-size:40px;line-height:1;letter-spacing:0.02em;color:#f0ece0;">THANK YOU FOR APPLYING.</h1>
        <p style="${p}">${greetingHtml}</p>
        <p style="${p}">Thank you for applying to be part of the <span style="color:#c8f135;">founding cohort</span> of IHereByCommit.</p>
        <p style="${p}">Your application is in. There's nothing else you need to do right now.</p>
        <p style="${p}">We'll be in touch by text, at the phone number you gave us.</p>
        <p style="${p}">Questions, or something in your application changed? Just reply to this email.</p>
        <p style="${p}">Thanks again for raising your hand.</p>
        <p style="margin:28px 0 0 0;font-family:${display};font-size:22px;letter-spacing:0.08em;color:#f0ece0;">THE IHEREBYCOMMIT TEAM</p>
        <p style="margin:4px 0 0 0;font-family:${mono};font-size:13px;"><a href="https://iherebycommit.com" style="color:#c8f135;text-decoration:none;">iherebycommit.com</a></p>
      </td></tr>
      <tr><td style="padding:18px 40px 26px 40px;border-top:1px solid #333333;font-family:${mono};font-size:11px;line-height:1.6;color:#888888;">
        You're getting this one-time email because you applied at iherebycommit.com.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { subject: SUBJECT, text, html };
}

export type ThankYouResult =
  | { status: "skipped"; reason: string }
  | { status: "sent"; providerId: string | null; isTest: boolean }
  | { status: "failed"; reason: string };

/**
 * Claim the row, send through Resend, release the claim on failure.
 * Never throws.
 */
export async function sendThankYouEmail(
  supabase: SupabaseLike,
  row: { id: string; email: string; first_name: string | null },
  env: (k: string) => string | undefined = (k) => Deno.env.get(k),
  fetchImpl: typeof fetch = fetch,
): Promise<ThankYouResult> {
  try {
    const mode = parseMode(env("THANK_YOU_EMAIL_MODE"));
    const recipient = resolveRecipient(
      row.email,
      mode,
      env("THANK_YOU_EMAIL_TEST_TRIGGER") || DEFAULT_TEST_TRIGGER,
      env("THANK_YOU_EMAIL_TEST_INBOX") || DEFAULT_TEST_INBOX,
    );
    if (!recipient) return { status: "skipped", reason: `mode=${mode} or address not eligible` };

    const apiKey = env("RESEND_API_KEY");
    if (!apiKey) {
      console.warn("thank-you email: RESEND_API_KEY not set, skipping");
      return { status: "skipped", reason: "no RESEND_API_KEY" };
    }

    // Atomic claim: only one caller can move NULL -> timestamp.
    const claimedAt = new Date().toISOString();
    const { data: claimed, error: claimError } = await supabase
      .from("waitlist")
      .update({ confirmation_email_sent_at: claimedAt })
      .eq("id", row.id)
      .is("confirmation_email_sent_at", null)
      .select("id");
    if (claimError) {
      console.error("thank-you email: claim failed (column missing?), not sending:", claimError.message);
      return { status: "skipped", reason: "claim error" };
    }
    if (!claimed || claimed.length === 0) return { status: "skipped", reason: "already sent" };

    const { subject, text, html } = buildThankYouEmail(row.first_name);
    let resp: Response;
    try {
      resp = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `thank-you/${row.id}`,
        },
        body: JSON.stringify({
          from: env("THANK_YOU_EMAIL_FROM") || DEFAULT_FROM,
          to: [recipient.to],
          reply_to: env("THANK_YOU_EMAIL_REPLY_TO") || DEFAULT_REPLY_TO,
          subject,
          text,
          html,
          tags: [{ name: "type", value: recipient.isTest ? "thank_you_test" : "thank_you" }],
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
    } catch (e) {
      await releaseClaim(supabase, row.id, claimedAt);
      console.error("thank-you email: send error:", e instanceof Error ? e.message : String(e));
      return { status: "failed", reason: "network" };
    }

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      await releaseClaim(supabase, row.id, claimedAt);
      console.error(`thank-you email: Resend ${resp.status}:`, body.slice(0, 300));
      return { status: "failed", reason: `resend ${resp.status}` };
    }
    const data = await resp.json().catch(() => ({}));
    console.log(`thank-you email sent for waitlist ${row.id}${recipient.isTest ? " (test path)" : ""}`);
    return { status: "sent", providerId: (data && data.id) || null, isTest: recipient.isTest };
  } catch (e) {
    console.error("thank-you email: unexpected error:", e instanceof Error ? e.message : String(e));
    return { status: "failed", reason: "unexpected" };
  }
}

async function releaseClaim(supabase: SupabaseLike, id: string, claimedAt: string): Promise<void> {
  const { error } = await supabase
    .from("waitlist")
    .update({ confirmation_email_sent_at: null })
    .eq("id", id)
    .eq("confirmation_email_sent_at", claimedAt);
  if (error) console.error("thank-you email: release claim failed:", error.message);
}
