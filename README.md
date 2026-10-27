# Force · prototype

A web prototype of the Force iOS app, built to be opened on a phone and added to the Home Screen.
Live build: https://force-proto.vercel.app

**Force in one line:** a companion that builds your longitudinal memory and helps you find your perfect side quest partnerships.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Open it on a phone (same network, or a tunnel) and use Share → Add to Home Screen; it runs standalone without Safari chrome.
On a desktop browser it renders inside an iPhone frame.

| URL flag | What it does |
| --- | --- |
| `/?onboard=1` | Replays the onboarding (it otherwise runs once; the flag lives in `localStorage` as `force.onboarded`). |
| `/?demo=new` | Starts with an empty memory, as a first-time person would see it. Default is the Mira persona. |

Checks, all of which must pass before a deploy:

```bash
npx tsc --noEmit     # types
npm run lint         # eslint
npm run check:words  # banned vocabulary in copy (see package.json)
npm run build
```

Deploy (needs access to the Vercel project): `vercel deploy --prod --yes --name force-proto`.

## Residency build (`/residency`, this branch)

The flow being tested with the residency. Live: https://force-proto.vercel.app/residency. Every visit starts from the beginning; `?keep=1` keeps where you were.

1. **Mark** paints itself, then moves on by itself (`components/r/Onboarding.tsx`).
2. **Connect:** name, LinkedIn / X / Instagram / GitHub / website (pasted URLs read back as handles), extra links, Onairos (`components/r/Links.tsx`). No phone number, no permission screens: the browser asks for the mic when it's needed.
3. **Three questions** as a chat. Tap the glass orb and talk (the screen ripples from it; tap anywhere to finish), or type. No hold gesture, so it behaves the same on iOS and Android.
4. **Pattern map** arrives in the chat and grows while Force analyses (`components/r/PatternWorld.tsx`). Node kinds: you → intents & problems → themes & approaches → residents who share a theme. Tap it to open your page.
5. **Your page** (`components/r/Persona.tsx`): the map (drag to turn, tap a node for what it is and where it was read), the patterns (swipe right = that's me, left = not me, tap = rewrite; an instruction card shows on first visit), voice, Onairos traits, your links (editable; changing one re-reads what was found online; "Read me again" re-runs it), found online (swipe away namesakes), next moves, "How close is this?".
6. **Home** (`components/r/Residents.tsx`): your face (your page) → **People** (energy map of the residency) → **Conversations** (Force first, then every resident; threads open with Force saying why you match). Side quests are shown as a preview, "coming after the residency".

What's mock and where the real data goes: everything in `data/residency.ts` (questions, residents, `pointsFrom`, `worldFor`, `foundFor`, `TRAITS`, `HEADLINE`, `MOVES`). Replace those with the agent / scraper / Onairos output; the components only read from the store in `lib/f/residency.ts`. Onairos is simulated: the real one is `npm i onairos`, `<OnairosButton requestData={{ personality: true }} onComplete={…} />`.

Browsers: recording uses `MediaRecorder` (mp4 on Safari, webm on Chrome/Android) and falls back to a labelled sample without a mic; transcripts use the browser's speech recognition where it exists (not Firefox). The ripple needs WebGL and a DOM snapshot; where either fails it falls back to plain rings from the orb.

## What's in it

```
app/
  layout.tsx        metadata: share card, icons, manifest, theme colour
  page.tsx          mounts the app; exposes window.__f (store actions) in dev
  globals.css       type scale, bars, surfaces, pills
styles/tokens.css   colour, depth, radius and motion tokens (the whole palette lives here)
data/
  mira.ts           the Mira persona: entries (moments), themes, clips, patterns, paintings
  social.ts         side quests, the people on the energy map, what they disclose and when
lib/f/
  store.ts          zustand store: chat, memory, side quests, energy map, threads, settings
  companion.ts      what Force says back (scripted, see "Real vs simulated")
  analyse.ts        pattern map + voice read over a set of moments
  audio.ts          mic recording (real), level metering, clip from file
  player.ts         one app-wide audio player
  ripple.ts         WebGL ripple shader used by voice mode
components/f/
  App.tsx           page stack, swipe-back, toasts, onboarding gate
  Companion.tsx     home: the conversation with Force
  Composer.tsx      the field: + menu, text, hold-to-talk mic
  Bubbles.tsx       message bubbles, audio bubble, pull-sideways gesture
  VoiceMode.tsx     hold anywhere → the screen becomes water (snapshot + ripple shader)
  Memory.tsx        memory: the world, filters, search, side quests, maps, moments
  Graph3D.tsx       the world: a 3D canvas of moments strung by theme, painted goo
  EntryView.tsx     a moment: rich text, media blocks, bottom add bar, autosave
  Quests.tsx        a side quest page; shared row components; `useMyForce`
  Energy.tsx        energy map: conversations, painted covers, dive page, map, threads with polls
  Sheet.tsx         the pattern map sheet (mini map, patterns, voice, next moves)
  Onboarding.tsx    number → code → permissions → connections → three voice questions → tour
  PaintedMark.tsx   the mark painted in oil pastel (splash)
  Profile.tsx       you: counts, what Force can use / read, replay, start over
  Nav.tsx, Face.tsx, Goo.tsx, Calendar.tsx, marks.tsx, ui.tsx   shared pieces
public/
  art/              the oil pastel paintings (one per theme) used everywhere colour appears
  icons/            earlier painted icons (unused in the light version, kept for later)
  og.png, icon-*.png, apple-touch-icon.png, manifest.webmanifest
```

## How it fits together

- **Home is the conversation.** Force greets, offers a few replies, and everything you say is kept as a *moment* on the side quest it belongs to. There is nothing to save. Hold anywhere on the conversation to talk (voice mode); hold or pull a message sideways to open its pattern map.
- **Memory (left pill, or swipe right).** The world first (every moment as a drop in its theme's painting, strung to the ones it shares a theme with), filters and search above it, then side quests, pattern maps you've made, and every moment. Tap a drop to see it; Select to pick several; Pattern map runs on whatever is in hand.
- **Energy map (right pill).** Conversations at the top, then "Your energy lately" as painted covers (tap one to dive into the painting: a side quest for that energy and who shares it), then the map: you, with a strand to each person; shorter strand, nearer energy. Before both say yes, only a first name and the shared side quest are shown. Threads are a group of three: you, them and Force, who posts polls.
- **Pattern map** is the only analysis. If there's voice in what it's reading, what your voice did appears inside the same map. Next moves can be kept (nudge) or let go by swiping.
- **Onboarding** ends with three questions answered out loud; those answers become the first moments, and the world grows from them in front of you.

## Real vs simulated

| Real | Simulated (and where) |
| --- | --- |
| Recording from the mic, level metering, playback | Force's replies: scripted on keywords and the persona's past (`lib/f/companion.ts`) |
| All gestures, pages, sheets, voice-mode ripple | Pattern maps: counted from the persona's data, not a model (`lib/f/analyse.ts`, `data/mira.ts`) |
| Entry editing, formatting, media blocks, autosave (in memory for the session) | Speech-to-text: real recordings have no transcript yet |
| Browser permission prompts (mic, notifications, location) | People, matching, "they said yes", their replies (`data/social.ts`, `store.ts`) |
| Onboarding flow, `localStorage` flag | Phone number / code: any six digits pass; no SMS |
| | Calendar / Photos / Notes connections: a timer, no API |
| | Nudges: kept moves are stored, nothing is scheduled |

Nothing persists between reloads except the onboarded flag. There is no backend.

## Design rules the code follows

- Type: 26 / 20 / 16 / 15 / 13 / 12 (body is 15), the phone's own font; Syne Mono for dates only. At most three sizes per screen.
- 8pt grid, 16pt side margins, 44pt minimum tap targets, 52pt main pills.
- Warm greys (`styles/tokens.css`), near-black ink, one accent (blue, state only), soft shadows, no borders.
- Colour comes from the paintings (`public/art`, `ART_SRC` / `ART_TONE` in `data/mira.ts`), never from generated gradients.
- Motion only where something physically moves: sheets, pages growing from their pill, drags, the ripple. Content appears, it doesn't animate in.
- Chat language everywhere: bubbles, white pills, the composer shape. New flows are built from these parts.

## Known limits of a web build

These need a native wrapper (Capacitor is the quickest route) rather than more web work:
- The ↑ ↓ Done bar above the iOS keyboard is Safari's and cannot be removed.
- Haptics: `navigator.vibrate` works on Android only.
- Notifications / nudges, background audio, Contacts, Calendar and Photos access.
- Voice mode photographs the screen once when you hold; it can't follow a screen that changes while you talk.
