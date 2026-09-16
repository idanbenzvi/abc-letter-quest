# Pedagogy

The design choices below aren't arbitrary — each maps to a specific,
well-established finding in early-literacy research (the "Science of
Reading" / structured-literacy consensus), adapted for a child who is
learning English as a second language rather than her first.

## Systematic phonics, initial-sound-first

Letter-sound correspondence — not letter *naming* — is the strongest
predictor of early decoding ability. The game always teaches the sound a
letter makes at the **start of a word** before or alongside the letter
name, because that's the unit a child needs to eventually sound out new
words. This is why every letter screen shows: letter → word → image →
isolated initial phoneme, never letter-name in isolation.

## Dual coding (Paivio)

Pairing a printed word with an image and a spoken sound creates two
independent memory traces (verbal + visual) that reinforce each other,
which is stronger than either alone. Every word-practice screen carries
all three simultaneously: the image, the printed word with the target
letter highlighted, and a tap-to-hear affordance for both the whole word
and the isolated phoneme.

## Multisensory / structured-literacy tracing (Orton-Gillingham lineage)

Phase 2's tracing isn't handwriting practice for its own sake — kinesthetic
letter-formation practice measurably strengthens the letter-shape-to-sound
association versus visual recognition alone. The tracing engine (see
[07-architecture.md](./07-architecture.md)) should track a completion
*quality* score, not just completion, so the child is reinforcing correct
motor formation, not just scribbling inside a box.

## Spaced repetition, not fixed drilling

"Repeat successful letters less often" is the Leitner/SM-2 family of
spaced-repetition scheduling: items move between boxes based on
performance, and box determines how soon an item is due again. The exact
scheduler used here is documented in
[05-spaced-repetition.md](./05-spaced-repetition.md) and implemented in
`app/src/engine/scheduler.ts`.

## L2-aware sequencing

Because Mia already has full English phonological awareness (she can
hear and produce every one of these sounds in speech — the gap is purely
sound-to-grapheme mapping), sequencing should:

- **Avoid alphabetical order** as the sole curriculum order, since it
  places visually confusable letter pairs close together with no
  reinforcement gap (b/d, p/q, m/n).
- **Front-load sounds/spellings that are genuinely new territory** for
  many L1 backgrounds (short vowel distinctions, digraphs like "th",
  "sh") rather than assuming exposure order doesn't matter.
- Read the onboarding reading-level answer as a pacing signal: "just
  starting out" gets more repetition per letter before advancing;
  "know some letters" can move faster through early letters and spend
  the saved time on the letters she actually gets wrong; "already reads
  in another language" can skip straight to less-repetitive review mode
  since the skill being taught is really an alphabet + sound-mapping
  transfer, not phonological awareness from scratch.

**Implementation note:** the Phase 1 MVP (see
[09-roadmap.md](./09-roadmap.md)) ships with straightforward alphabetical
curriculum order to get the core loop working end-to-end first —
resequencing by confusability/frequency is flagged as a fast-follow, not
dropped. Don't read alphabetical order in the current code as the
intended final design.

## Errorless-leaning feedback

No penalty sounds, no red X, no visible "wrong" state that reads as
failure. A wrong tap gets a gentle nudge toward the right answer rather
than a correction; celebrated *attempts* outweigh celebrated
*correctness* in the copy and animation. Sessions are scoped short
(a handful of items, not an open-ended drill) to match realistic
attention span at this age — see the session-queue sizing in
[05-spaced-repetition.md](./05-spaced-repetition.md).
