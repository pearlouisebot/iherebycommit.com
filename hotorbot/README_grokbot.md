# Hot or Bot

A swipe deck of short vertical clips. Open [/hotorbot/](https://iherebycommit.com/hotorbot/) on the phone. Each card is one clip. You vote once: hot, not, bot, or human. The latest vote is the one that sticks.

The database is already live on the same Supabase project as the waitlist (`dqrmyqmpqnlemkwdndsf`). This page does not create tables. It uses the publishable key already in the site. There is no service-role key in the client.

## Watch and vote

The page asks for a deck (`get_swipe_deck`). How many to ask for is the `DECK_LIMIT` constant at the top of `hotorbot/index.html`. It defaults to 10. The server only returns clips you have not voted on, and it caps the request between 1 and 50. Clip names are not hardcoded. When the deck comes back empty, the page says you've seen them all.

The clip on screen plays inline, muted, and looped. Tap the picture (or "Tap for sound") to unmute. Only that clip plays. The next card's poster image is preloaded while you watch. Swipe right or tap Hot. Swipe left or tap Not. Bot and Human are buttons. The page times the watch from when the video starts until the vote, and sends that as `dwell_ms` with `client` set to `web`.

Voting needs a signed-in Supabase user. The first vote calls `supabase.auth.signInAnonymously()`. Anonymous sign-ins are off in the dashboard right now (Authentication → Sign In / Providers → Allow anonymous sign-ins). Until that is turned on, the deck still loads and plays. A vote shows: "Voting isn't open yet — sign-in is turned off. You can still watch the deck." The page does not crash, and it does not pretend the vote was saved.

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

`get_video_profile_tallies` is signed-in only. The page does not show tallies. Clips live in the public `hotorbot-videos` bucket (`clips/` and `posters/`). The deck RPC returns the full URLs.

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

Playback on iOS is `AVQueuePlayer` + `AVPlayerLooper`, muted until the viewer taps for sound. Dwell time starts when `play()` is called.

## SQL

The schema, seed, storage bucket, and deck fix are already applied. This repo does not keep a `migrations/` or `supabase/` SQL folder (research SQL lives in a private repo, and `master` is published by GitHub Pages), so those reference files were not copied in here.
