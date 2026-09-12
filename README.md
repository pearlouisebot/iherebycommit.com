# iherebycommit.com — landing page

One file, no build step, no dependencies beyond Google Fonts.

## Deploy

**Netlify / Vercel / Cloudflare Pages** — drag this folder into the dashboard. Done.
**Any host** — upload `index.html` to the web root.
**GitHub Pages** — push the folder, enable Pages on the branch.

Point `iherebycommit.com` at whichever you pick.

---

## THE ONE THING TO DO BEFORE IT GOES LIVE

**The email form does not store anything yet.** It validates and shows a
confirmation, and then the address is gone.

The NYT piece will send more traffic than the page will ever see again.
A form that silently discards addresses is the single most expensive
bug on this site.

### To fix it — pick one, ~15 minutes

**ConvertKit** — Grow → Landing Pages & Forms → create form → Embed → HTML.
Replace the `<form id="join-form">` block with theirs, keep the surrounding
markup so the styling holds.

**Mailchimp** — Audience → Signup forms → Embedded forms. Same swap.

**Formspree** — no list management, just delivery. Change one line:
```html
<form id="join-form" action="https://formspree.io/f/YOUR_ID" method="POST">
```
and delete the `<script>` block at the bottom so the real submit goes through.

**Buttondown** — cheapest if you want to write to the list later. Same pattern.

### Then test it properly
Submit from your own phone, on cellular, not wifi. Confirm the address
actually arrives in the list. Do this before you send the URL to anyone.

---

## Before launch

- [ ] Email capture wired and tested from a phone
- [ ] `hello@iherebycommit.com` exists and is monitored
- [ ] Confirm the January Sunday dates (10, 17, 24, 31) are what you want
- [ ] Legal review — the founder quote, and any League figures
- [ ] Add analytics if you want conversion data (Plausible or Fathom; both
      are cookieless, which matters given what the page says about privacy)
- [ ] Add a favicon and an og:image — the page has OG tags but no image,
      so link previews will be bare

## What's in the page

Mobile-first. Base styles are the phone; 38rem and 60rem are enhancements.
Forced-dark defences included — some Android browsers and in-app webviews
invert pages regardless of `color-scheme`, so every surface declares an
explicit background.

The claim under the timeline names eHarmony and Tawkify deliberately.
Both have published peer-reviewed research; the defensible claim is that
nobody has run a **controlled trial**, not that nobody has published.
Don't revert that to "zero studies" — it isn't true and the people you
most want to impress know it isn't.
