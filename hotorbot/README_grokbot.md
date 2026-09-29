# Hot or Bot

A swipe deck of short vertical clips. Open [/hotorbot/](https://iherebycommit.com/hotorbot/) on the phone. Each card is one clip. You vote once: hot, not, bot, or human. The latest vote is the one that sticks.

The database is already live on the same Supabase project as the waitlist (`dqrmyqmpqnlemkwdndsf`). This page does not create tables. It uses the publishable key already in the site. There is no service-role key in the client.

## Watch and vote

The page asks for a deck (`get_swipe_deck`). How many to ask for is the `DECK_LIMIT` constant at the top of `hotorbot/index.html`. It defaults to 10. The server only returns clips you have not voted on, and it caps the request between 1 and 50. When the deck comes back empty, the page says you've seen them all.

Play and show only the `video_url` and `poster_url` on each row. Do not build storage paths in the client. Those paths can change (for example `clips/v2/clip-N.mp4` instead of `clips/clip-N.mp4`) when the placeholder clips are replaced with real footage.

The page matches the post-onboarding mockup: splash ("HOT or BOT", "Free to rate. Pay to match."), a profile card, then a 1–10 score. After each score there is a short rated screen and a Next button. At the end you see your average. Someone who just finished the study application skips the splash and lands on the first clip.

The clip on screen plays inline, muted, and looped, even if the file has audio. Tap the picture (or "Tap for sound") to unmute. Only that clip's video is loaded. Leaving the card cancels that download. The next card preloads its poster image and does not fetch its video until it is on screen. The page times the watch from when the video starts until the score, and sends that as `dwell_ms` with `client` set to `web`.

The score buttons are 1 through 10, as in the mockup. The vote call only accepts `hot`, `not`, `bot`, or `human`, so 1–5 is stored as `not` and 6–10 as `hot`. The page does not label anyone bot or human. That ground truth is not in the deck response, and the clips may be real people. Name, school, and job lines stay empty unless a deck row actually includes them. The counter uses the number of rows returned, not a hardcoded 25.

Voting needs a signed-in Supabase user. The first score calls `supabase.auth.signInAnonymously()`. Anonymous sign-ins are off in the dashboard right now (Authentication → Sign In / Providers → Allow anonymous sign-ins). Until that is turned on, the deck still loads and plays. A score shows: "Voting isn't open yet — sign-in is turned off. You can still watch the deck." The page does not crash, and it does not pretend the score was saved.

After the study form is submitted, the site opens `/hotorbot/`. The application screens themselves are unchanged. `/hotorbot/` also works on its own.

## Call it from the web

The page already does this with `@supabase/supabase-js` v2. The same calls:

```js
const { data: deck } = await supabase.rpc('get_swipe_deck', { p_limit: 10 })

const { data: { session } } = await supabase.auth.getSession()
if (!session) await supabase.auth.signInAnonymously()

await supabase.rpc('cast_swipe_vote', {
  p_video_profile_id: card.id,
  p_vote: 'hot',       // hot | not | bot | human
  p_dwell_ms: 4200,
  p_client: 'web'
})
```

`get_video_profile_tallies` is signed-in only. The page does not show tallies. The deck RPC returns the full video and poster URLs. Use those. The files live in the public `hotorbot-videos` bucket, but the object path is not part of the client contract.

## Call it from iOS

There is no iOS app in this repo. `ios/HotOrBot_grokbot/HotOrBotClient.swift` is ready to drop into one. Add the [supabase-swift](https://github.com/supabase/supabase-swift) package (v2), then:

```swift
let api = HotOrBotClient()
let deck = try await api.deck()                    // no login required
let row = try await api.castVote(                  // signs in anonymously if needed
    videoProfileId: card.id,
    vote: "hot",
    dwellMs: 3100,
    clientName: "ios"
)
```

`HotOrBotDeckView()` is a small SwiftUI screen with the same votes, muted looping playback, and the same message when anonymous sign-in is off.

Playback on iOS is one `AVPlayerItem` at a time, created from `video_url`, muted until the viewer taps for sound (so a soundtrack does not block autoplay). Looping seeks back to the start. The next card preloads `poster_url` only. The on-screen scores are 1–10; `castVote` is called with `not` for 1–5 and `hot` for 6–10. Dwell time starts when `play()` is called.

## SQL

The schema, seed, storage bucket, and deck fix are already applied. This repo does not keep a `migrations/` or `supabase/` SQL folder (research SQL lives in a private repo, and `master` is published by GitHub Pages), so those reference files were not copied in here.
