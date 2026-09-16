# Spaced repetition scheduler

Implemented in `app/src/engine/scheduler.ts`. This doc and that file
must stay in sync — if you change one, change the other.

## Boxes

A Leitner-style 5-box model per letter (`LetterProgress.box`):

| box | meaning |
|---|---|
| 0 | New — never attempted |
| 1 | Learning — attempted, shaky |
| 2 | Review — getting there |
| 3 | Confident |
| 4 | Mastered |

## Review interval per box

Rather than real calendar time (unreliable for a child who might play
once a day or three times in an hour), intervals are counted in
**sessions played**, via a per-letter `reviewGap` counter:

```
INTERVALS = { 0: 0, 1: 1, 2: 2, 3: 4, 4: 8 }
```

A box-4 (mastered) letter waits roughly 8 sessions before it's eligible
to resurface — this is the concrete mechanism behind "repeat successful
letters less frequently." A box-1 letter resurfaces almost every
session until it climbs.

## Updating a letter after an attempt

```
onAnswer(letter, wasCorrect):
  if wasCorrect:
    letter.box = min(4, letter.box + 1)
  else:
    letter.box = max(0, letter.box - 1)
  letter.reviewGap = INTERVALS[letter.box]
  letter.attempts += 1
  letter.correct += wasCorrect ? 1 : 0
  letter.correctStreak = wasCorrect ? letter.correctStreak + 1 : 0
  letter.lastSeenAt = now()
```

A letter newly reaching box 4 (from a lower box, this attempt) is what
triggers the Celebration screen for that letter — see
[04-screens-spec.md](./04-screens-spec.md#6-celebration).

## Decrementing due-ness each session

At the start of every session, every already-introduced letter
(`box >= 1`) gets `reviewGap = max(0, reviewGap - 1)`. A letter is
**due** when `reviewGap === 0`.

## Building a session queue

Target queue size: **5 items** (tunable; short enough to respect a
6-year-old's attention span per [02-pedagogy.md](./02-pedagogy.md)).

```
buildQueue(focusLetter, allLetters, curriculumOrder, size = 5):
  queue = [focusLetter]                      # always first — it's why they tapped this stone
  introduced = allLetters where box >= 1 and letter != focusLetter
  due = introduced where reviewGap == 0, sorted by box ascending
        (lower box = higher priority, i.e. shakier items surface first)
  notYetDue = introduced where reviewGap > 0, sorted by box ascending
  fillers = take (size - 1) items, preferring `due`, then `notYetDue`
  queue += shuffle(fillers)
  return queue
```

Early in the game (few letters introduced yet) the queue is naturally
shorter than 5 — that's expected, not a bug.

## Reachability (which stones are unlocked on the World Map)

A letter is reachable once every earlier letter in curriculum order has
`box >= 2` (review stage) — see the reachability rationale in
[04-screens-spec.md](./04-screens-spec.md#2-world-map). This is computed
live from state on every render, not stored separately.

## Curriculum order

Phase 1 MVP: plain alphabetical (`app/src/data/curriculum.ts`). The
L2-aware resequencing described in
[02-pedagogy.md](./02-pedagogy.md#l2-aware-sequencing) (avoid adjacent
confusable pairs, front-load novel sounds) is a documented fast-follow —
`curriculum.ts` is a single exported array specifically so reordering it
later is a one-line change, not a refactor.
