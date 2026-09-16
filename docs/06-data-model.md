# Data model

Defined in `app/src/types.ts`, persisted whole as one JSON blob in
`localStorage` (see [07-architecture.md](./07-architecture.md) for why
localStorage over IndexedDB for Phase 1, and why no backend at all).

```ts
type ReadingLevel = 'starting' | 'some-letters' | 'fluent-reader';
type Avatar = 'fox' | 'bee' | 'owl' | 'cat' | 'rabbit';

interface Profile {
  name: string;
  age: number;
  avatar: Avatar;
  readingLevel: ReadingLevel;
  createdAt: string; // ISO
}

type MasteryBox = 0 | 1 | 2 | 3 | 4;

interface LetterProgress {
  letter: string;        // 'A'
  box: MasteryBox;
  reviewGap: number;      // sessions until next due, see 05-spaced-repetition.md
  attempts: number;
  correct: number;
  correctStreak: number;
  lastSeenAt: string | null; // ISO
  masteredAt: string | null; // ISO, set once when box first reaches 4
  selfWords: string[];       // words the child spoke & matched herself; capped, most recent last; NOT a scheduler input
  lastWordId: string | null; // id of the word shown last time, so the picker avoids repeating it — see engine/wordBank.ts
}

interface WordEntry {
  id: string;    // 'apple'
  letter: string; // 'A'
  word: string;   // 'Apple'
  phoneme: string; // '/æ/' — display only, not used for audio synthesis logic
}
// Multiple WordEntry per letter now (docs/09-roadmap.md) — grouped as
// WORDS_BY_LETTER in app/src/data/words.ts, picked per session by
// engine/wordBank.ts's pickWordForLetter.

interface SessionSummary {
  date: string;       // 'YYYY-MM-DD', local calendar day
  startedAt: string;  // ISO
  endedAt: string;    // ISO
  lettersPracticed: string[];
  correctCount: number;
  totalCount: number;
}

interface AppState {
  profile: Profile | null;
  letters: Record<string, LetterProgress>; // keyed A-Z, always all 26 once profile exists
  sessions: SessionSummary[];
  starsTotal: number; // lifetime correct-answer count, shown as "stars" in the UI
}
```

## Notes

- `letters` is always fully populated (all 26 keys) once a profile
  exists — there's no "letter doesn't exist yet" state, only `box: 0`.
  Simplifies every screen that reads it.
- `selfWords` is populated only by the bonus speech challenge (see
  [04-screens-spec.md](./04-screens-spec.md#bonus-challenge-think-of-your-own-word))
  and is display-only for the parent dashboard — nothing in the
  scheduler reads it.
- `starsTotal` is derived data technically (`sum of correct across
  letters`), but stored redundantly for a cheap top-bar read; recompute
  it from `letters` if the two ever disagree rather than trusting a
  stale cache.
- **Zones and companions are static content, not persisted state.**
  `app/src/data/zones.ts`'s `Zone`/`Companion` types aren't part of
  `AppState` — a zone's completion (and therefore whether its companion
  shows as unlocked) is computed live from `letters` every render via
  `engine/zones.ts`'s `isZoneComplete`, the same pattern as
  `starsTotal` could have used but didn't. Don't add a `crew: string[]`
  field to `AppState` to "cache" this — it would just be another thing
  that could disagree with `letters`.
- Nothing here has a `traceBox` yet — that's called out in
  [04-screens-spec.md](./04-screens-spec.md#4-tracing-phase-2--spec-only-until-built-see-roadmap)
  as a Phase 2 addition, don't add it speculatively before the tracing
  engine exists to use it.

## Settings additions

- `soundEnabled: boolean` (default `true`) — sound effects + ambient
  bed (`engine/sfx.ts`). Spoken letters are never muted by it. Saves
  from before this key existed are filled in by
  `storage.ts`'s `withSettingsDefaults` on load.
- `writingPractice: 'off' | 'first-assisted' | 'always-assisted'`
  (default `'first-assisted'`) — the lined writing page that appears
  every few traced letters (`components/WritingPractice.tsx`). Filled in
  for older saves by `withSettingsDefaults` like `soundEnabled`.
