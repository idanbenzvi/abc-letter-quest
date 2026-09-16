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
}

export type WritingPracticeMode = 'off' | 'first-assisted' | 'always-assisted';

/** One child's own progress — everything that used to be the whole app's state, before multiple players/profiles existed. */
export interface PlayerState {
  profile: Profile | null;
  letters: Record<string, LetterProgress>;
  sessions: SessionSummary[];
  starsTotal: number;
  settings: Settings;
}

/** The whole persisted app: every player's own data, keyed by a generated player id, plus which one is currently playing. */
export interface AppState {
  players: Record<string, PlayerState>;
  activePlayerId: string | null;
}
