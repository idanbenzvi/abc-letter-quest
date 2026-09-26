export type ReadingLevel = 'starting' | 'some-letters' | 'fluent-reader';
export type Avatar = 'fox' | 'bee' | 'owl' | 'cat' | 'rabbit';

export interface Profile {
  name: string;
  age: number;
  avatar: Avatar;
  readingLevel: ReadingLevel;
  createdAt: string;
}

export type MasteryBox = 0 | 1 | 2 | 3 | 4;

export interface LetterProgress {
  letter: string;
  box: MasteryBox;
  reviewGap: number;
  attempts: number;
  correct: number;
  correctStreak: number;
  lastSeenAt: string | null;
  masteredAt: string | null;
  /** Words the child spoke and matched herself in the bonus challenge — see docs/04-screens-spec.md#bonus-challenge-think-of-your-own-word. Capped, most recent last. Not a scheduler input. */
  selfWords: string[];
  /** id of the word shown last time this letter came up, so engine/wordBank.ts can avoid repeating it back-to-back. */
  lastWordId: string | null;
}

export interface WordEntry {
  id: string;
  letter: string;
  word: string;
  phoneme: string;
}

export interface SessionSummary {
  date: string;
  startedAt: string;
  endedAt: string;
  lettersPracticed: string[];
  correctCount: number;
  totalCount: number;
}

export interface Settings {
  /** Length of one flight mission, in seconds — also the dawn-to-night arc's duration. Parent-configurable from the Dashboard. */
  missionDurationSeconds: number;
  /** Sound effects + ambient wind/sea bed (engine/sfx.ts). Spoken letters (engine/audio.ts) are never muted by this — they're the lesson, not decoration. */
  soundEnabled: boolean;
  /**
   * The lined writing round (components/WritingPractice.tsx) that appears
   * every few traced letters and asks the child to write the letter three
   * times between dashed lines. 'first-assisted': the guide shows for the
   * first repetition only, then the child writes unaided (the default —
   * assistance that fades is how handwriting is actually taught).
   * 'always-assisted': the guide shows every time. 'off': no writing rounds.
   */
  writingPractice: WritingPracticeMode;
  /**
   * "Which one did I say?" rounds (three/LetterMatchup.tsx) — two
   * commonly-confused lowercase letters (b/d, h/n, m/w...) shown side by
   * side, motionless, so a child can carefully compare their shapes
   * rather than pick one out of a moving scene. Occasional, like the
   * plane-choice bonus, and only ever offered for a letter that actually
   * has a look-alike (see data/confusablePairs.ts) — this toggle is the
   * parent's way to turn that off entirely if it's not helpful yet.
   */
  lookAlikePractice: boolean;
  /**
   * "Write it on paper" — an opt-in webcam bonus (components/
   * HandwritingCheck.tsx): the child writes the current letter on real
   * paper with a real pencil, the camera takes one photo once they say
   * they're done, and a shape-match against the letter's own outline
   * (engine/handwritingMatch.ts) decides whether it counts. Off by
   * default — unlike every other bonus path in this game it needs real
   * setup (a camera positioned at a piece of paper, plus a permission
   * grant), so a parent opts in deliberately rather than it appearing
   * unannounced mid-flight.
   */
  handwritingCheck: boolean;
  /**
   * What the game says for a letter (engine/audio.ts's sayLetter): its
   * name ("bee"), its sound ("buh" — see data/letterSounds.ts), or both,
   * name then sound (the default). Letter SOUNDS, not names, are what
   * predict learning to read (docs/02-pedagogy.md), so 'names' is there
   * for a grown-up who wants it, not as the default. The word-blending
   * round uses sounds unless this is 'names' — blending c-a-t only works
   * with sounds.
   */
  letterVoice: LetterVoice;
  /**
   * Letters a grown-up wants practised (uppercase), e.g. the week's
   * letters at school or a stubborn b/d. When set, about half of every
   * flight is drawn from them — even ones the curriculum pool hasn't
   * reached yet (see engine/flightMission.ts's FOCUS_SHARE). Empty = off.
   */
  focusLetters: string[];
}

export type LetterVoice = 'names' | 'sounds' | 'both';

export type WritingPracticeMode = 'off' | 'first-assisted' | 'always-assisted';

/** One child's own progress — everything that used to be the whole app's state, before multiple players/profiles existed. */
export interface PlayerState {
  profile: Profile | null;
  letters: Record<string, LetterProgress>;
  sessions: SessionSummary[];
  starsTotal: number;
  settings: Settings;
  /** Mastered letters the child has already watched hatch in "My Nest" (screens/Nest.tsx) — anything mastered since hatches on the next visit. */
  nestSeen?: string[];
}

/** The whole persisted app: every player's own data, keyed by a generated player id, plus which one is currently playing. */
export interface AppState {
  players: Record<string, PlayerState>;
  activePlayerId: string | null;
}
