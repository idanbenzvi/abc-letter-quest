# Screens — functional spec

Started as six screens matching the design canvas 1:1 in purpose (visual
polish in the real app is scoped per [09-roadmap.md](./09-roadmap.md);
this doc specifies *behavior*). A seventh — Chapter Complete — was added
once "Home Path" became the zone-based "World Map" (see below);
everything here reflects the current app, not just the original canvas.

## 1. Onboarding

**Fields:** name (text), age (3-9, chip picker), avatar (fox/bee/owl/
cat/rabbit), reading level (`starting` / `some-letters` / `fluent-reader`
— see [02-pedagogy.md](./02-pedagogy.md) for how this affects pacing).

**On submit:**
- Creates a `Profile` (see [06-data-model.md](./06-data-model.md)).
- Initializes `LetterProgress` for all 26 letters at box 0.
- Persists immediately (see [07-architecture.md](./07-architecture.md)),
  navigates to the World Map.
- Only runs once — if a profile already exists on load, skip straight to
  World Map. (A "switch player" affordance is out of scope for Phase 1;
  one device, one child.)

## 2. World Map

**Shows:** all 26 letters as stepping stones in curriculum order,
grouped into four visually-distinct **zones** (chapters) — see
`app/src/data/zones.ts`:

| Zone | Letters | Companion |
|---|---|---|
| Whisper Woods | A-F | Fern the Bunny |
| Sunny Meadow | G-L | Buzz the Bee |
| Sparkle Shore | M-R | Splash the Otter |
| Starlight Peak | S-Z | Nova the Firefly |

Each zone is its own tinted band on one horizontally-scrolling map, with
its own header showing the zone name and an `X/6` (or `/8`) mastered
count. This grouping is a **narrative device layered on top of the
existing linear curriculum** — it changes nothing about how letters
individually unlock (still the reachability rule below) or how the
scheduler works ([05-spaced-repetition.md](./05-spaced-repetition.md));
it's purely how the same progress is framed and displayed. Each stone's
visual state is derived live from its `LetterProgress.box`:

| box | state | visual |
|---|---|---|
| not yet reached in curriculum order | locked | dimmed, mystery-sparkle icon |
| 0-3, reached | current/in-progress | coral, enlarged if it's the *next due* item |
| 4 | mastered | leaf green, gold star badge |

**"Reached"** means: every earlier letter in curriculum order is at box
≥ 2 ("review" stage — see [05-spaced-repetition.md](./05-spaced-repetition.md)).
This is deliberate interleaving, not a strict gate: the child doesn't
need to *fully* master letter N before starting letter N+1, just get it
solidly into review rotation. Fully gating on mastery would stall
progress on one stubborn letter for too long; never gating at all would
overwhelm with too many half-known letters in rotation at once.

**Tap a reachable stone →** builds a session queue (see
[05-spaced-repetition.md](./05-spaced-repetition.md)) seeded on that
letter and navigates to Letter Learning.

**A "your crew" row** above the map shows one slot per zone: a
companion icon once that zone is fully mastered (all its letters at box
4), or a grey silhouette with "???" otherwise — see
[7. Chapter Complete](#7-chapter-complete) for how a companion is
actually unlocked. This is the map's answer to "why keep going" beyond
the letters themselves: a visible, permanent cast that grows as the
child progresses, not just a percentage.

**Top bar:** avatar + name, star count (lifetime total correct answers),
day streak, a settings/gear button to Dashboard (parent-gated in intent,
not technically locked in Phase 1 — see roadmap).

## 3. Letter Learning

One screen, sequenced through the session queue (typically 5 items — see
scheduler doc for how items are chosen). Per item:

1. **Reveal beat — fully automatic, no tap required to advance:**
   a. Buddy: "Listen close — you already know this sound!" — the
      letter shown static (both cases together, e.g. "Aa"), tap-to-hear
      available (see audio strategy in
      [07-architecture.md](./07-architecture.md)). After ~1.3s, auto-advances.
   b. "Watch — here's how to write a big {LETTER}!" — the uppercase
      letterform is drawn stroke-by-stroke, animated (correct stroke
      order and direction, not just a generic wipe) — see
      [07-architecture.md](./07-architecture.md#letter-writing-animation).
      Auto-advances the instant the animation finishes.
   c. "Now the little {letter} — almost the same!" — same animation,
      lowercase form.
   d. The word card (below) appears the moment (c) finishes — **no
      click**. A "Skip ahead" link is available during (b)/(c) for a
      letter the child has already watched written many times in
      review (it jumps straight to the word), since this beat repeats
      every time the letter comes up, not just the first time.
2. **Word confirmation:** word + image + phoneme badge, tap-to-hear the
   whole word. Establishes "the sound you just found starts this word
   too." The word itself is picked from a **pool of several words per
   letter** (`app/src/data/words.ts`, `engine/wordBank.ts`), avoiding
   whichever word that letter showed last time — so reviewing a letter
   repeatedly doesn't mean staring at the same flashcard every session.
   Starting the quiz itself (below) is still a deliberate tap — the
   quiz is the actual assessment, unlike the reveal beat above.
3. **Mini-game:** "Which picture starts with the /x/ sound?" — 3
   choices, 1 correct + 2 distractors. Distractor selection rule:
   distractor initial phonemes must be **clearly distinct** from the
   target (never pick two distractors that are themselves confusable
   with the target or each other) and should preferentially be drawn
   from *already-introduced* letters so the whole screen stays within
   what the child has actually seen.
4. **Feedback:** correct → brief celebration, log the attempt, advance.
   Incorrect → gentle nudge, highlight the correct choice, still log the
   attempt (as incorrect — this drives the scheduler), advance after a
   beat. No retry-until-correct loop — one attempt per item keeps
   session length predictable and avoids frustration spirals.

### Bonus challenge: "think of your own word"

Runs once per session — only for the letter the child actually chose to
play (queue index 0), not for every review item — right after that
item's quiz is answered, before the Next/Finish button appears. Skipped
entirely (no dead UI, no mention) if the browser doesn't support speech
recognition; see [07-architecture.md](./07-architecture.md#speech-to-text-bonus-word-challenge)
for the privacy tradeoff this feature accepts.

Flow: "Can YOU think of a word that starts with {letter}?" → child taps
a mic button → one short recognized utterance → the transcript's first
word is checked against the target letter (**spelling match, not a
phonetic one** — see the caveat in `engine/wordMatch.ts`) → match:
warm specific praise using the child's actual word, +1 star, the word
is logged to that letter's `selfWords` (shown on the parent dashboard);
no match or recognition trouble: gentle, never "wrong" — offer another
try or skip, always both.

This round is **deliberately decoupled from the spaced-repetition
scheduler** — a match never advances `box` beyond what the quiz already
did, and a miss never regresses it. Recognition accuracy and a child's
willingness to speak into a device both vary too much to let this drive
the authoritative mastery signal; it's rewarded enrichment, not
assessment. It also must never leave the child stuck: the "Listening…"
state always shows an immediate way out ("Never mind"), independent of
`engine/speech.ts`'s own 8-second timeout — belt and suspenders, because
getting trapped on a silent mic screen is exactly the kind of moment
this whole game is designed to avoid.

**End of queue:** any letter that newly crossed into box 4 (mastered)
during the session queues a Celebration; if that also completed a zone
(every one of its letters now at box 4), a Chapter Complete queues right
behind it. Both are shown in sequence — letter celebrations first, then
chapter completions — before returning to the World Map. See
`buildMomentQueue` in `App.tsx`.

## 4. Tracing (Phase 2 — spec only until built, see roadmap)

Per letter, once it's reached box ≥ 2: dotted-outline letter with
numbered stroke-start point and direction arrow, a wide low-opacity
"tolerance corridor" around the true stroke path, live sparkle trail
following the traced point. Produces a 0-100 quality score per attempt
(coverage of the corridor + staying-within-corridor ratio — exact
formula belongs in the architecture doc once the tracing engine is
built). Up to 3 attempts shown per session; best score logged. Tracing
quality does **not** gate the recognition-side mastery box — they're
tracked as separate skills (`LetterProgress.traceBox` alongside
`LetterProgress.box`), since a child can reliably *recognize* a letter
well before she can *write* it cleanly, and the game shouldn't make
writing skill a prerequisite for reading-side progress.

## 5. Dashboard (parent view)

Read-only reflection of real state, no separate data model:

- Alphabet grid, color-coded by `box` (0-1 = not started/sky outline,
  2-3 = practicing/sun, 4 = mastered/leaf) — same three-state legend as
  the home path but rendered as a dense grid instead of a path.
- "Words I know well" = letters at box 4, their assigned word.
- "Needs more practice" = letters at box 1-3 that have been attempted at
  least once (never show a not-yet-reached letter here — this was a
  real inconsistency caught in canvas review, see
  [09-roadmap.md](./09-roadmap.md) changelog).
- Weekly streak = consecutive calendar days with ≥1 logged session.
- "Time this week" = real elapsed time, sum of `endedAt - startedAt`
  across this week's `SessionSummary` entries — **not** a fabricated or
  estimated number; if this can't be computed honestly (e.g. missing
  timestamps), show nothing rather than a guess.

## 6. Celebration

Triggered by a letter newly reaching box 4 within a just-finished
session (never as a standalone route). Shows the letter, "You knew the
sound. Now you know its shape," the growing badge strip of all
box-4 letters, and a line tying it back to the Buddy narrative
("Buddy's Letter-Song grows stronger!"). Single "Keep Going" action
advances to the next queued moment, or the World Map if there isn't one.

## 7. Chapter Complete

Triggered once, the moment every letter in a zone reaches box 4 (see
[2. World Map](#2-world-map) and `engine/zones.ts`'s `isZoneComplete`).
Bigger and rarer than a per-letter Celebration — this is the "a new
friend joins the journey" beat, the main payoff for the zone/companion
structure:

- Eyebrow "Chapter Complete", headline "You found the {Zone} melody!",
  a line tying it back to Buddy's song.
- The zone's companion, revealed large, by name, with a one-line blurb
  written for that specific companion (`app/src/data/zones.ts`) — not
  generic "you unlocked a reward" copy.
- One action, named for the companion ("Add {Name} to my journey!"),
  returns to the World Map, where that companion now appears in the
  "your crew" row instead of a locked silhouette.

Detection happens in `LetterLearning.tsx`: when a letter newly reaches
box 4, it checks whether that was the *last* letter its zone needed
(every other letter in the zone already reflects its true box in
state — only the one just answered is still "projected" at that
instant) and queues a `{kind: 'zone', zoneId}` moment alongside any
letter-celebration moments, per `App.tsx`'s `buildMomentQueue`.
