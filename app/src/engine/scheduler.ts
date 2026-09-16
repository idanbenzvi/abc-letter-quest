// Spaced-repetition scheduler. Keep this in sync with
// docs/05-spaced-repetition.md — that file is the spec, this is the
// implementation, they must not drift.

import type { LetterProgress, MasteryBox } from '../types';

export const INTERVALS: Record<MasteryBox, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 4,
  4: 8,
};

export const QUEUE_SIZE = 5;
export const REACHABLE_MIN_BOX: MasteryBox = 2;

export function createLetterProgress(letter: string): LetterProgress {
  return {
    letter,
    box: 0,
    reviewGap: 0,
    attempts: 0,
    correct: 0,
    correctStreak: 0,
    lastSeenAt: null,
    masteredAt: null,
    selfWords: [],
    lastWordId: null,
  };
}

const SELF_WORDS_CAP = 5;

/** Appends a self-generated word to a letter's log, deduped, capped, most recent last. */
export function addSelfWord(progress: LetterProgress, word: string): LetterProgress {
  const withoutDupe = progress.selfWords.filter((w) => w.toLowerCase() !== word.toLowerCase());
  return { ...progress, selfWords: [...withoutDupe, word].slice(-SELF_WORDS_CAP) };
}

/** Returns a new LetterProgress reflecting one answered attempt. */
export function applyAnswer(progress: LetterProgress, wasCorrect: boolean, now = new Date()): LetterProgress {
  const nextBox = (wasCorrect ? Math.min(4, progress.box + 1) : Math.max(0, progress.box - 1)) as MasteryBox;
  const justMastered = nextBox === 4 && progress.box !== 4;
  return {
    ...progress,
    box: nextBox,
    reviewGap: INTERVALS[nextBox],
    attempts: progress.attempts + 1,
    correct: progress.correct + (wasCorrect ? 1 : 0),
    correctStreak: wasCorrect ? progress.correctStreak + 1 : 0,
    lastSeenAt: now.toISOString(),
    masteredAt: justMastered ? now.toISOString() : progress.masteredAt,
  };
}

/** Call once at the start of a session, before building the queue. */
export function decaySessionGaps(letters: Record<string, LetterProgress>): Record<string, LetterProgress> {
  const next: Record<string, LetterProgress> = {};
  for (const [letter, progress] of Object.entries(letters)) {
    next[letter] = progress.box >= 1 ? { ...progress, reviewGap: Math.max(0, progress.reviewGap - 1) } : progress;
  }
  return next;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A letter is reachable once every earlier letter in curriculum order
 * has reached REACHABLE_MIN_BOX. See docs/04-screens-spec.md#2-home-path.
 */
export function isReachable(
  letter: string,
  letters: Record<string, LetterProgress>,
  curriculumOrder: readonly string[],
): boolean {
  const idx = curriculumOrder.indexOf(letter);
  if (idx <= 0) return true;
  return curriculumOrder
    .slice(0, idx)
    .every((earlier) => (letters[earlier]?.box ?? 0) >= REACHABLE_MIN_BOX);
}

/** The letter the Home Path should visually emphasize as "play next". */
export function getFocusLetter(
  letters: Record<string, LetterProgress>,
  curriculumOrder: readonly string[],
): string | null {
  for (const letter of curriculumOrder) {
    if (!isReachable(letter, letters, curriculumOrder)) return null;
    if ((letters[letter]?.box ?? 0) < 4) return letter;
  }
  return null; // whole alphabet mastered
}

/**
 * Builds one session's practice queue. focusLetter is always first;
 * the rest is filled from already-introduced letters, prioritizing
 * items that are due, weighted toward lower boxes.
 */
export function buildQueue(
  focusLetter: string,
  letters: Record<string, LetterProgress>,
  size: number = QUEUE_SIZE,
): string[] {
  const introduced = Object.values(letters).filter((p) => p.box >= 1 && p.letter !== focusLetter);
  const due = introduced.filter((p) => p.reviewGap <= 0).sort((a, b) => a.box - b.box);
  const notYetDue = introduced.filter((p) => p.reviewGap > 0).sort((a, b) => a.box - b.box);

  const fillers: string[] = [];
  for (const p of [...due, ...notYetDue]) {
    if (fillers.length >= size - 1) break;
    fillers.push(p.letter);
  }

  return [focusLetter, ...shuffle(fillers)];
}
