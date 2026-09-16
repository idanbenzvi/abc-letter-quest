import type { LetterProgress, WordEntry } from '../types';

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Picks distractor words for the "which starts with this sound?" quiz.
 * Rules from docs/04-screens-spec.md#3-letter-learning: distractor
 * initial phonemes must be clearly distinct from the target, and
 * distractors should preferentially come from already-introduced
 * letters so the quiz stays within what the child has actually seen.
 */
export function pickDistractors(
  target: WordEntry,
  allWords: WordEntry[],
  letters: Record<string, LetterProgress>,
  count = 2,
): WordEntry[] {
  const pool = allWords.filter((w) => w.letter !== target.letter && w.phoneme !== target.phoneme);
  const introduced = pool.filter((w) => (letters[w.letter]?.box ?? 0) >= 1);
  const notYetIntroduced = pool.filter((w) => (letters[w.letter]?.box ?? 0) < 1);
  const ordered = [...shuffle(introduced), ...shuffle(notYetIntroduced)];
  return ordered.slice(0, count);
}

export function buildQuizOptions(
  target: WordEntry,
  allWords: WordEntry[],
  letters: Record<string, LetterProgress>,
): WordEntry[] {
  const distractors = pickDistractors(target, allWords, letters, 2);
  return shuffle([target, ...distractors]);
}
