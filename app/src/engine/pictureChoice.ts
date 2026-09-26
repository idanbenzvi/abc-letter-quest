import type { WordEntry } from '../types';
import { WORDS } from '../data/words';
import { ILLUSTRATED_WORD_IDS } from '../components/icons/WordIcons';

const ILLUSTRATED_WORDS = WORDS.filter((w) => ILLUSTRATED_WORD_IDS.has(w.id));

export interface PictureChoiceEntry {
  word: WordEntry;
  isTarget: boolean;
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
 * "3 flash cards, one starts with the letter" bonus — tapping the right
 * one pays the same bonus as typing the letter. Now supported across all
 * 26 letters with multiple possible illustrated flash cards per letter.
 */
export function buildPictureChoices(canonicalLetter: string, count = 3): PictureChoiceEntry[] | null {
  const targetCandidates = ILLUSTRATED_WORDS.filter((w) => w.letter === canonicalLetter);
  if (targetCandidates.length === 0) return null;
  const target = targetCandidates[Math.floor(Math.random() * targetCandidates.length)];

  // Pick distractors from distinct other letters
  const otherLetters = shuffle(
    Array.from(new Set(ILLUSTRATED_WORDS.filter((w) => w.letter !== canonicalLetter).map((w) => w.letter)))
  );
  if (otherLetters.length < count - 1) return null;

  const distractors: WordEntry[] = [];
  for (let i = 0; i < count - 1; i++) {
    const letter = otherLetters[i];
    const wordsForLetter = ILLUSTRATED_WORDS.filter((w) => w.letter === letter);
    const chosen = wordsForLetter[Math.floor(Math.random() * wordsForLetter.length)];
    distractors.push(chosen);
  }

  return shuffle([{ word: target, isTarget: true }, ...distractors.map((word) => ({ word, isTarget: false }))]);
}

