import { assertEquals, assert } from "jsr:@std/assert@1";
import { buildThankYouEmail, parseMode, resolveRecipient, sendThankYouEmail } from "./thankYouEmail_grokbot.ts";

Deno.test("mode defaults to off", () => {
  assertEquals(parseMode(undefined), "off");
  assertEquals(parseMode("LIVE"), "live");
  assertEquals(parseMode("yes"), "off");
});

Deno.test("recipient rules", () => {
  assertEquals(resolveRecipient("a@b.com", "off"), null);
  assertEquals(resolveRecipient("a@b.com", "test_only"), null);
  assertEquals(resolveRecipient("A@B.com", "live"), { to: "a@b.com", isTest: false });
  assertEquals(resolveRecipient("qa+grokbot-7@example.com", "live"), null);
  assertEquals(resolveRecipient("x@sub.example.com", "live"), null);
  assertEquals(resolveRecipient("qa+grokbot-email@example.com", "test_only"), { to: "delivered@resend.dev", isTest: true });
  assertEquals(resolveRecipient("qa+grokbot-email@example.com", "off"), null);
});

Deno.test("copy: personalised, escaped, no promises", () => {
  const e = buildThankYouEmail("  <Sam>  ");
  assert(e.text.startsWith("Hi <Sam>,"));
  assert(e.html.includes("Hi &lt;Sam&gt;,"));
  assert(buildThankYouEmail("").text.startsWith("Hi there,"));
  for (const body of [e.text, e.html]) {
    for (const bad of [/accept/i, /study/i, /compensat/i, /\bpaid\b/i, /league/i, /research/i, /guarantee/i]) {
      assert(!bad.test(body), `found ${bad}`);
    }
  }
});

function fakeSupabase(claimRows: unknown[] | null, claimError: unknown = null) {
  const calls: string[] = [];
  const builder = (payload: unknown) => {
    const q: Record<string, unknown> = {};
    q.eq = () => q; q.is = () => q;
    q.select = () => Promise.resolve({ data: claimRows, error: claimError });
    q.then = (res: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(res);
    calls.push(JSON.stringify(payload));
    return q;
  };
  return { calls, client: { from: () => ({ update: builder }) } };
}
const env = (m: Record<string, string>) => (k: string) => m[k];

Deno.test("send: off by default, no fetch", async () => {
  let fetched = false;
  const sb = fakeSupabase([{ id: "1" }]);
  const r = await sendThankYouEmail(sb.client, { id: "1", email: "a@b.com", first_name: "A" }, env({ RESEND_API_KEY: "k" }), (() => { fetched = true; return Promise.resolve(new Response("{}")); }) as typeof fetch);
  assertEquals(r.status, "skipped"); assertEquals(fetched, false); assertEquals(sb.calls.length, 0);
});

Deno.test("send: already claimed -> no fetch", async () => {
  let fetched = false;
  const sb = fakeSupabase([]);
  const r = await sendThankYouEmail(sb.client, { id: "1", email: "a@b.com", first_name: "A" }, env({ RESEND_API_KEY: "k", THANK_YOU_EMAIL_MODE: "live" }), (() => { fetched = true; return Promise.resolve(new Response("{}")); }) as typeof fetch);
  assertEquals(r, { status: "skipped", reason: "already sent" }); assertEquals(fetched, false);
});

Deno.test("send: column missing -> no fetch", async () => {
  let fetched = false;
  const sb = fakeSupabase(null, { message: "column does not exist" });
  const r = await sendThankYouEmail(sb.client, { id: "1", email: "a@b.com", first_name: "A" }, env({ RESEND_API_KEY: "k", THANK_YOU_EMAIL_MODE: "live" }), (() => { fetched = true; return Promise.resolve(new Response("{}")); }) as typeof fetch);
  assertEquals(r.status, "skipped"); assertEquals(fetched, false);
});

Deno.test("send: test path goes to test inbox with idempotency key", async () => {
  let req: { url: string; init: RequestInit } | null = null;
  const sb = fakeSupabase([{ id: "row-1" }]);
  const r = await sendThankYouEmail(sb.client, { id: "row-1", email: "qa+grokbot-email@example.com", first_name: "Q" }, env({ RESEND_API_KEY: "k", THANK_YOU_EMAIL_MODE: "test_only" }),
    ((url: string, init: RequestInit) => { req = { url, init }; return Promise.resolve(new Response(JSON.stringify({ id: "re_1" }), { status: 200 })); }) as unknown as typeof fetch);
  assertEquals(r, { status: "sent", providerId: "re_1", isTest: true });
  const body = JSON.parse(req!.init.body as string);
  assertEquals(body.to, ["delivered@resend.dev"]);
  assertEquals(body.from, "IHereByCommit <hello@iherebycommit.com>");
  assertEquals((req!.init.headers as Record<string, string>)["Idempotency-Key"], "thank-you/row-1");
});

Deno.test("send: provider error releases claim, never throws", async () => {
  const sb = fakeSupabase([{ id: "1" }]);
  const r = await sendThankYouEmail(sb.client, { id: "1", email: "a@b.com", first_name: "A" }, env({ RESEND_API_KEY: "k", THANK_YOU_EMAIL_MODE: "live" }), (() => Promise.resolve(new Response("bad", { status: 422 }))) as typeof fetch);
  assertEquals(r.status, "failed");
  assertEquals(sb.calls.length, 2);
  assert(sb.calls[1].includes("null"));
  const r2 = await sendThankYouEmail(sb.client, { id: "1", email: "a@b.com", first_name: "A" }, env({ RESEND_API_KEY: "k", THANK_YOU_EMAIL_MODE: "live" }), (() => Promise.reject(new Error("down"))) as typeof fetch);
  assertEquals(r2.status, "failed");
});
