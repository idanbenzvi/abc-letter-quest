# Architecture

## Stack

- **Vite + React + TypeScript**, no CSS framework — a single
  `theme.css` defines the design-token CSS variables
  ([03-design-system.md](./03-design-system.md)) and each screen has a
  small co-located `.css` file. Chosen over Tailwind to keep the token
  values in exactly one place (the same oklch values as the design
  canvas) rather than mapped through a second config.
- **State:** one React Context + `useReducer` (`src/state/AppContext.tsx`)
  holding the whole `AppState`. No Redux/Zustand — the state shape is
  small and single-player, a reducer is enough and keeps dependencies
  minimal for a project one person maintains.
- **Persistence:** `localStorage`, one JSON blob under a single key,
  written on every reducer action via a subscriber in `AppContext`. Not
  IndexedDB — the whole state is well under localStorage's size limits
  for the foreseeable feature set (single profile, 26 letters, a
  rolling session log), and localStorage's synchronous API is simpler
  for a "save immediately, every time" persistence model with no risk
  of a torn write across screens.
- **Routing:** no router library. A single `type Screen = 'onboarding' |
  'home' | 'learn' | 'dashboard'` in `App.tsx` state — this is a linear,
  single-flow kid's app, not a multi-page site; a router would be
  overhead with nothing to route between that a plain switch doesn't
  already handle. Revisit only if the app grows enough screens that this
  becomes unwieldy.
- **PWA/offline:** deferred to Phase 3 (see [09-roadmap.md](./09-roadmap.md))
  — `vite-plugin-pwa` is the intended path when it's time (manifest +
  service worker, installable to the tablet home screen, offline-first
  since there's no backend to be offline *from* anyway).

## 3D stack (flight game)

`three` + `@react-three/fiber` + `@react-three/drei`, added for the
flight game — see [10-flight-game.md](./10-flight-game.md). Installed
with `--legacy-peer-deps`: `@react-three/fiber@9.7.0` declares a peer
range of `react: '>=19 <19.3'`, and this project's React resolved to
`19.3.0` (a valid match for the project's own `^19.1.0` range, just
outside fiber's narrower one). This isn't just a version-string
technicality to ignore — a real bug traced back to it during testing
(see the flight-game doc's "two real bugs" section) before being fixed
properly at the code level. Re-check this peer range when upgrading
either package.

## Privacy stance

No accounts, no analytics. Everything the app knows about the child
lives in one localStorage blob on that one device. This is a deliberate
constraint, not a missing feature — COPPA-relevant risk should be
designed out structurally rather than managed through a privacy policy
for a product built for one specific 6-year-old.

**One documented exception:** the bonus "think of your own word"
challenge (see
[04-screens-spec.md](./04-screens-spec.md#bonus-challenge-think-of-your-own-word))
uses the browser's built-in `SpeechRecognition`, which in Chrome-family
browsers sends the recorded audio to Google's cloud speech service for
transcription — this is the one runtime network call in the app beyond
the Google Fonts stylesheet, and the one place audio briefly leaves the
device. It's opt-in per use (the child taps a mic button; nothing
records without that tap), the audio itself is never stored by this
app, and only the resulting transcript's first letter is kept (as the
plain-text `selfWords` log — see
[06-data-model.md](./06-data-model.md)), not the transcript's full
content or the audio. If this tradeoff isn't acceptable, the honest
fix is an on-device model (e.g. a small Whisper build compiled to
WASM/ONNX via `transformers.js`) rather than quietly dropping the
feature — flagged in
[09-roadmap.md](./09-roadmap.md) as a Phase 3+ option, not implemented
here because of the added bundle size and processing latency for a
first pass.

## Speech-to-text (bonus word challenge)

`src/engine/speech.ts` wraps the browser's `SpeechRecognition` /
`webkitSpeechRecognition` (feature-detected — Firefox and some Safari
versions don't implement it, in which case the whole bonus round is
skipped, not shown broken). See the privacy tradeoff this accepts above
under "Privacy stance," and the matching heuristic's known limitation
in `src/engine/wordMatch.ts`'s doc comment (spelling match, not
phonetic — will misjudge irregular spellings like "city" for /s/).

Reliability matters more than accuracy here: `listenOnce()` always
settles within 8 seconds even if the browser never fires a result/error
event (observed for real against a headless test browser — it can just
go silent), and the UI additionally offers an immediate "Never mind"
exit during the listening state itself, because a child must never be
stranded on an unresponsive mic screen. A match awards a small bonus
star and logs the word; a miss is never treated as evidence the child
was wrong, since a mishearing is at least as likely as an actual wrong
answer — this round intentionally doesn't touch the spaced-repetition
scheduler at all (see
[05-spaced-repetition.md](./05-spaced-repetition.md)).

## Audio strategy

Phase 1 MVP uses the browser's built-in `SpeechSynthesis` API
(`window.speechSynthesis`) for both whole-word and isolated-phoneme
playback — zero asset cost, works offline (the synthesis itself; see
below for the one exception), no dependency on the AI art pipeline
being run. This is an explicit, known-limited placeholder: a synthesized
voice's isolated-phoneme pronunciation is noticeably less accurate/
natural than a real recorded children's voice, which matters for a
phonics app where correct sound modeling is the whole point. **Before
this ships to an actual child for real practice, phoneme audio in
particular should be replaced with real recordings** (a native speaker
recording each of the ~26 initial phonemes cleanly is a small, finite
task, unlike the illustration asset problem which benefits from
generation at scale). Track this as a Phase 3 item, not a Phase 1 one —
see roadmap.

**Voice selection.** The browser's *default* voice is often the worst
available option — on Linux especially, the default is frequently a
local espeak-style voice even when a much more natural one is
installed or reachable. `engine/audio.ts` actively picks the best
available voice instead of accepting the default: it scores every
voice `speechSynthesis.getVoices()` returns against a curated,
quality-ranked list of known-good **female** English voice names
(sourced, CC0/BSD-3-Clause, from the community-maintained
[readium/speech](https://github.com/readium/speech) /
[web-speech-recommended-voices](https://github.com/HadrienGardeur/web-speech-recommended-voices)
datasets — the Web Speech API itself exposes no quality signal, so
there's no way to derive this from the API alone), and falls back to
any voice whose own name says "female" if none of the curated ones are
present. If nothing matches, it leaves the voice unset — never worse
than the old behavior, just not improved.

What's actually available depends entirely on the browser playing the
game, and this couldn't be verified from here: headless Chromium in
this sandbox reports zero voices (no OS speech backend, no network TTS
reachable), so the selection logic is implemented and unit-testable but
its real output has to be judged in an actual browser. The best
realistic case, and the most likely one on desktop Chrome (any OS,
including Linux): Chrome ships a free built-in network voice called
"Google US English" — no setup, no account — which the curated list
ranks highly and which is a real, noticeably more natural female voice
than local fallback voices. Windows + Edge does even better (Microsoft's
free "Online (Natural)" neural voices, e.g. "Jenny" or "Aria," rank
above it). Firefox and older/offline setups may have nothing better than
a local voice, in which case this code changes nothing — there's no
free fix for a browser with no good voice installed short of adding a
paid cloud TTS API (ElevenLabs, Google Cloud TTS, Azure — all have free
tiers but require an API key and reintroduce a real network dependency
beyond the one already accepted for
[speech-to-text](#speech-to-text-bonus-word-challenge)), which hasn't
been added here.

**Recorded letter audio (built).** Rather than a live third-party TTS
API — which would mean either shipping an API key in a client-only app
(a real security/cost problem: anyone can extract a key from the
bundle and burn through the account's quota) or standing up a backend
just to hide it — `engine/audio.ts` now checks for a **pre-generated**
audio file first, per letter, before falling back to the synthesis
path above. `speak(letter)` tries `public/audio/letters/<LETTER>.mp3`;
if it 404s (`<audio>`'s `error` event), it silently falls back to
`SpeechSynthesis`, and remembers the 404 so it doesn't retry that
letter every tap. This means: no API key ships in the app, no network
call during play, no ongoing cost, and the letter set can be filled in
incrementally — a half-recorded alphabet works fine, each letter
independently uses whichever source is actually available for it. See
`public/audio/letters/README.md` for the exact file-naming convention
and how to generate clips (ElevenLabs' free tier or any other TTS/
recording source — the app doesn't care how the MP3s were made).

## Letter writing animation

Not to be confused with the Tracing engine below — this is a **watch,
not touch** demonstration: `StrokeAnimation.tsx` plays each stroke of a
letter's construction as an SVG stroke-dasharray/dashoffset reveal (plus
a small dot following the pen path via CSS `offset-path`), in correct
teaching stroke order, uppercase then lowercase, per letter learning
item (see
[04-screens-spec.md](./04-screens-spec.md#3-letter-learning)). No
pointer input, no scoring — that interactive version is the separate,
not-yet-built Phase 2 feature described just below. This one exists to
give a stronger sense of "how letters are actually formed" without
waiting for the touch-tracing engine to be built.

The stroke path data itself (`src/data/letterStrokes.ts`) is
**generated, not hand-edited** — `scripts/generate-letter-strokes.mjs`
computes every curve from clock-angle trig (`ept(cx, cy, rx, ry, deg)`,
0°=top, 90°=right, increasing clockwise) rather than hand-typed Bézier
control points, specifically so a letter that looks wrong can be
retuned by adjusting a couple of numbers and rerunning
(`node scripts/generate-letter-strokes.mjs`) rather than hand-editing
SVG path strings. All 52 letterforms (26 uppercase + 26 lowercase) were
visually verified in a throwaway grid render before being wired in — a
non-obvious pitfall worth knowing if you touch this again: an SVG arc's
endpoint + radius does not uniquely determine its center in general
(two circles of the same radius usually pass through any two given
points), so an open arc like C/G/c's ring needs its large-arc-flag
**forced** to 1 rather than computed from the angular span — the
"compute it from the span" version silently drew the tiny mirrored
arc instead of the big intended one for exactly this reason (caught by
the visual QA render, not by types or tests — geometry bugs like this
don't throw).

## Tracing engine (Phase 2, not yet built)

Sketch, to be refined into real code when Phase 2 starts:

- Each traceable letter has a **stroke path** defined as an SVG path
  string (same authoring approach as the `Tracing.dc.html` mockup) plus
  a start point and direction.
- On pointer/touch move during a trace attempt, sample the pointer
  position at a fixed interval and compute distance-to-path using the
  path's `getPointAtLength`/`getTotalLength` (native SVG geometry APIs)
  to build a "how far off the ideal corridor was each sample" series.
- **Score** = weighted combination of (a) corridor-coverage: fraction of
  the path's length that had at least one sample within tolerance, and
  (b) corridor-adherence: fraction of samples that were within
  tolerance. Both matter — (a) alone lets a child scribble back and
  forth over one spot and "cover" nothing; (b) alone doesn't check the
  whole letter got traced.
- This is a canvas/SVG-geometry problem, not a machine-learning one —
  no model or library needed, `getPointAtLength` plus a distance check
  is sufficient and keeps this dependency-free.

## Folder structure

```
app/
  scripts/
    generate-letter-strokes.mjs   # generates data/letterStrokes.ts, see "Letter writing animation" above
  index.html
  src/
    main.tsx
    App.tsx
    theme.css
    types.ts
    data/
      curriculum.ts     # letter order
      words.ts          # many WordEntry per letter — see docs/09-roadmap.md
      zones.ts          # the 4 story zones + their companions, docs/04-screens-spec.md#2-world-map
      letterStrokes.ts  # GENERATED — see scripts/generate-letter-strokes.mjs, don't hand-edit
    speech.d.ts           # ambient SpeechRecognition types (not in lib.dom.d.ts yet)
    engine/
      scheduler.ts       # 05-spaced-repetition.md, implemented
      storage.ts          # localStorage load/save
      audio.ts              # SpeechSynthesis + curated female-voice selection, see "Audio strategy" above
      speech.ts            # SpeechRecognition wrapper, see "Speech-to-text" above
      wordMatch.ts          # transcript-vs-letter matching heuristic
      wordBank.ts            # picks a word per letter, avoiding the last one shown
      quiz.ts                  # multiple-choice distractor selection
      stats.ts                  # streak / weekly-time / dashboard helpers
      zones.ts                   # isZoneComplete / zoneProgress — see docs/06-data-model.md's zones note
    state/
      AppContext.tsx
    components/
      StrokeAnimation.tsx (+ .css)  # letter-writing playback, see "Letter writing animation" above
      icons/              # WordIcons.tsx, BuddyIcon.tsx, CompanionIcon.tsx — inline SVG, flat-vector style
    screens/
      Onboarding.tsx (+ .css)
      WorldMap.tsx (+ .css)   # zone-grouped map, see docs/04-screens-spec.md#2-world-map
      ChapterComplete.tsx (+ .css) # companion-unlock moment
      LetterLearning.tsx (+ .css)
      BonusChallenge.tsx (+ .css)   # the speech-to-text round, see above
      Dashboard.tsx (+ .css)
      Celebration.tsx (+ .css)
```

## Where AI-generated art plugs in later

Nothing above depends on `assets/generated/*.png` existing. The icon
components in `components/icons/` are currently hand-built inline SVG
matching the design system, one per implemented word
([08-asset-pipeline.md](./08-asset-pipeline.md)). When real generated
art exists and is approved, swap a given icon's implementation from
inline SVG to an `<img src="...">` pointing at the generated file —
that's a change local to one component, nothing else in the app should
need to know the difference.
