# Study Demo — clickable prototype

A seven-screen prototype of a dating app built as a research instrument. Static HTML, no build step, no dependencies, no backend.

**Live flow:** `index.html` → `baseline.html` → `compare.html` → `ranking.html` → `match.html` → `feedback.html` → `pulse.html`

---

## What it demonstrates

The core mechanic is **pairwise comparison**, not swiping. Two profiles, one question: who would you rather meet. Each choice updates an Elo-style rating (a practical stand-in for the Bradley-Terry model), and the ranking screen shows a complete ordering estimated from those choices — including pairs the user never actually saw.

`compare.html` uses adaptive selection: it presents the pair the model is currently least certain about, which is why roughly twenty judgments produce a reliable top ten instead of the 31,125 comparisons an exhaustive approach would need.

`ranking.html` shows the estimated order and lets the user drag to correct it. Works with both mouse and touch.

Interaction state persists across pages via `localStorage`, and falls back to in-memory when storage is unavailable. `pulse.html` clears it so the demo can be run again.

---

## Files

```
demo/
├── index.html        consent fork — join the study or just use the app
├── baseline.html     stated preferences + questions about the person
├── compare.html      the pairwise comparison mechanic (interactive)
├── ranking.html      estimated ranking, drag to reorder (interactive)
├── match.html        match reveal — identical across all study arms
├── feedback.html     post-date form — where the second experiment lives
├── pulse.html        quarterly check-in — the outcome measure
└── assets/
    ├── style.css     all styling
    └── app.js        candidate pool, state persistence, ranking engine
```

---

## Deploying to GitHub Pages

Everything here is static. No build, no npm, no framework.

**Option A — repo root**

1. Create a public repo (e.g. `study-demo`)
2. Copy the contents of this `demo/` folder into the repo root, so `index.html` sits at the top level
3. Commit and push to `main`
4. Settings → Pages → Source: **Deploy from a branch** → Branch: `main`, folder: `/ (root)` → Save
5. Live in a minute or two at `https://<username>.github.io/study-demo/`

**Option B — docs folder**

Put the files in `/docs` instead and select folder `/docs` at step 4. Useful if the repo will also hold other work.

---

## Notes for whoever deploys this

- **All paths are relative.** Nothing needs a base URL set, and it works in a subdirectory.
- **No secrets, no API calls, no analytics.** The only external request is a Google Fonts stylesheet. Remove that link and the pages fall back to system fonts if you'd rather have zero external calls.
- **Fake data only.** The six candidate profiles in `assets/app.js` are invented. No real people, no photos — the avatars are CSS gradients.
- **Mobile-first.** The phone frame becomes full-bleed below 430px, so it looks like a real app on a phone rather than a mockup of one.
- **To change the candidate pool,** edit the `POOL` array at the top of `assets/app.js`. Keep everyone within a single dating pool — comparisons are only meaningful between candidates a given user would actually consider.
- **To change how fast the ranking converges,** adjust the `K` constant in `recordChoice()` in `assets/app.js`. Higher K means each comparison moves the ratings more.

---

## Known limitations

This is a prototype for showing people the interaction, not a foundation to build a product on.

- No accounts, no server, no persistence beyond the local browser
- The four study arms aren't implemented — `match.html` always returns the top-ranked candidate
- The post-date form always shows the structured variant; the free-text arm isn't built
- Six candidates rather than a realistic pool of a few hundred
- Elo stands in for Bradley-Terry. Same family of model and it converges to the same ordering, but a real implementation should fit the actual model on the full comparison history
