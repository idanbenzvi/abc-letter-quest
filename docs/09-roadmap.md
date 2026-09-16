# Roadmap

## Phase 0 — Concept (done)

- Pedagogical grounding, design canvas (6 mockup screens), the
  discovery/revelation narrative hook, AI asset pipeline configured
  (not run).

## Phase 1 — MVP core loop (in progress)

Real, working, end-to-end code — not mockups. Scope:

- Onboarding → World Map → Letter Learning → back to World Map, with
  Celebration firing on mastery and a Dashboard reflecting real state.
- Spaced-repetition scheduler ([05-spaced-repetition.md](./05-spaced-repetition.md)),
  fully implemented, not simulated.
- localStorage persistence, survives a page reload.
- A large word pool — several words per letter, all 26 letters
  (`app/src/data/words.ts`), picked with variety per session
  (`engine/wordBank.ts`) so review doesn't repeat the same flashcard.
  Icon coverage is narrower than word coverage on purpose: only
  apple/ball/cat/dog/elephant/fish are hand-illustrated; every other
  word renders through `WordIcon`'s generic fallback until more are
  hand-built or generated via the AI pipeline
  ([08-asset-pipeline.md](./08-asset-pipeline.md)) — expanding icon
  coverage to match the word list is explicitly not done here, tracked
  below.
- The alphabet is grouped into four story zones (chapters), each with
  its own companion character unlocked on completion — see
  [04-screens-spec.md](./04-screens-spec.md#2-world-map) and
  [#7-chapter-complete](./04-screens-spec.md#7-chapter-complete). This
  was a deliberate response to early feedback that the game felt
  "bland" with no character to journey with — the underlying letter
  curriculum/scheduler is unchanged, this is a narrative/UI layer on
  top of it.
- Audio via browser `SpeechSynthesis` (explicitly a placeholder — see
  [07-architecture.md](./07-architecture.md#audio-strategy)).
- Visual style matches the design system's tokens (palette, type,
  iconography rules) but does **not** yet reproduce every mockup detail
  (sparkle-trail animations, confetti, the letter reveal's exact
  dust-particle treatment) — functional fidelity first, animation
  polish is Phase 3.

**Added during this phase:** the reveal beat now shows the letter
uppercase and lowercase, then plays an animated "watch it get written"
demonstration for each case (correct stroke order, not just a generic
wipe), before the word card appears **automatically** — no tap needed
for any of that. See
[04-screens-spec.md](./04-screens-spec.md#3-letter-learning) and
[07-architecture.md](./07-architecture.md#letter-writing-animation).
This replaced the earlier tap-to-reveal ghost/solid letter toggle
entirely — that mechanic is gone, not layered underneath. All 52
letterforms (generated, not hand-typed — see the architecture doc for
why) were visually verified in a throwaway QA render before shipping;
one real bug (an SVG arc large-arc-flag issue that silently drew a tiny
wrong arc for C/G/c) was caught that way, and a second real bug (the
lowercase lookup using the letter's uppercase key, so every writing
animation for a lowercase letter would throw) was caught by an actual
browser run, not by the type checker.

**Paused, not removed:** the bonus speech-to-text challenge below is
implemented, tested, and left in the app — but further work on it is
on hold at the user's request in favor of the word-pool/world-map
engagement work above. Don't extend it further without checking that's
actually wanted again first.

**Added during this phase (past the original MVP scope):** the bonus
"think of your own word" speech-to-text challenge — see
[04-screens-spec.md](./04-screens-spec.md#bonus-challenge-think-of-your-own-word)
and [07-architecture.md](./07-architecture.md#speech-to-text-bonus-word-challenge)
for the design and the privacy tradeoff it knowingly accepts (the one
runtime network call in the app besides Google Fonts). Caught and fixed
during its own testing: the first version could strand a child on an
unresponsive "Listening…" screen if the browser's recognizer never
fired an event — fixed with both a hard timeout in
`engine/speech.ts` and an always-visible manual exit in the UI itself.

**Fixed during this phase (caught by review, not by the user):** the
Dashboard mockup originally showed "Elephant"/"Fish" under Needs More
Practice while the map showed E/F as still locked — an
internally-inconsistent state. The real Dashboard is now computed live
from actual `LetterProgress`, so this class of bug can't recur — it's
structurally impossible to show a word for a letter that hasn't been
attempted.

## Phase 1.5 — Core gameplay replaced (playable, feature-complete for v1)

Per direct user instruction, World Map + Letter Learning are replaced
by an albatross flight game — `App.tsx` routes here by default now.
See [10-flight-game.md](./10-flight-game.md) for the full spec and
tech. Built and verified end-to-end via full automated mission
playthroughs (not just piece-by-piece): the ocean/sky shader with a
real dawn-to-sunset mission clock, letter-shaped clouds with
sequential spawning, tap → speak → self-report, case progression tied
to real mastery data, session logging into the existing Dashboard, and
warm intro/end screens closing the "fly home to the nest" narrative.
Four real bugs were found and fixed along the way (documented in the
flight-game doc specifically so the mistakes aren't repeated) — all
four only surfaced under a genuine multi-step playthrough, not a
component-level check, which is why this doc leans so heavily on
"verified by actually playing it" rather than "should work." The
underlying data model and spaced-repetition scheduler are **not**
replaced, only the screens on top of them. Only the real bird model
(blocked on a paid Meshy download) and minor polish remain — see the
flight-game doc's "Not yet built." This supersedes Phase 2 (Tracing)'s
priority for now — tracing is built and working (see below) but the
screen it lived on is gone, so where it resurfaces in the new game is
an open question, not assumed to disappear.

## Phase 1.75 — Polish pass (done, Sep 2026)

A full "AAA-feel" sweep: sound design, a real HUD (star counter, letter
slots), pause menu with a press-and-hold grown-ups gate, an end screen
that celebrates newly-mastered letters (restoring the reward beat lost
when the Celebration screen was retired), asset preloading with a
loading veil, tablet hygiene (dvh, no pull-to-refresh, touch-action,
safe areas, manifest/icons), device-aware hints, three real rendering
fixes (tone-mapped foreground vs. un-mapped sky, black moon disc, dusk-
looking dawn), and a coherent albatross narrative on onboarding with
proper avatar art. Full list in
[10-flight-game.md](./10-flight-game.md#polish-pass-sep-2026--what-changed-and-why).
Second pass: gyro-driven camera parallax on tablets, and the trace
rebuilt as an always-on-top golden ribbon with a stroke-order guide
(numbered starts, dashed path, arrowheads, travelling comet) fitted onto
each letter cloud — see
[10-flight-game.md](./10-flight-game.md#tilt-camera--stroke-guide-sep-2026-second-pass).
Third and fourth passes: the flight freezes while a trace is in progress,
tracing scores every stroke of the letter (not footprint coverage), a
completed trace glows before it bursts, and every third traced letter
opens a lined writing page (guided once, then freehand; parent setting) —
see [10-flight-game.md](./10-flight-game.md#stroke-complete-tracing--the-lined-writing-page-sep-2026-fourth-pass).

## Phase 2 — Tracing

- Build the tracing engine per the sketch in
  [07-architecture.md](./07-architecture.md#tracing-engine-phase-2-not-yet-built).
- Add `traceBox` per letter, tracked separately from recognition
  `box` per [04-screens-spec.md](./04-screens-spec.md#4-tracing-phase-2--spec-only-until-built-see-roadmap).
- Wire the Tracing screen into the Letter Learning flow once a letter's
  recognition `box >= 2`.

## Phase 3 — Polish & content completion

- Run the AI asset pipeline for real: full 26-letter word set (2-4 word
  options per letter for scheduler variety), all Buddy poses.
- Swap `SpeechSynthesis` for real recorded phoneme/word audio.
- Animation pass: letter-reveal sparkle/dust effect, confetti on
  Celebration, tracing sparkle trail, transition motion between screens.
- `vite-plugin-pwa` — installable, offline-first.
- L2-aware curriculum resequencing (replace the alphabetical placeholder
  order per [02-pedagogy.md](./02-pedagogy.md#l2-aware-sequencing)).
- Optional: replace cloud `SpeechRecognition` with an on-device model
  (small Whisper build via WASM/ONNX) for the bonus word challenge, to
  close the one documented exception to the app's otherwise fully
  local/offline privacy stance — see
  [07-architecture.md](./07-architecture.md#speech-to-text-bonus-word-challenge).

## Phase 4 — Possible extensions (not committed)

- A second child profile / profile switcher, if ever needed beyond one
  player.
- Export/share a printable "certificate" per mastered letter for a
  parent to physically post — cheap, high-delight, no infrastructure.
- A more persistent, visible token of the companions' story arc beyond
  the crew row — e.g. something Buddy visibly carries/wears that fills
  in as companions join — if the current chapter-complete payoff turns
  out not to be enough on its own.
- Expand icon coverage beyond the 6 hand-built words, either by hand or
  by actually running the AI asset pipeline
  ([08-asset-pipeline.md](./08-asset-pipeline.md)) — note
  `assets/manifest.json` currently only lists letters A-F and needs
  extending to match the full word list in `app/src/data/words.ts`
  before a production run.
