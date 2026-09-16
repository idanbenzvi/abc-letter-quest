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
 * "3 pictures, one starts with the letter" bonus — tapping the right
 * one pays the same bonus as typing the letter. Only offered when the
 * target letter has a real illustrated word AND there are enough other
 * illustrated letters to fill the distractor slots — see
 * docs/08-asset-pipeline.md for why icon coverage is still narrow
 * (only A-F today). Returns null to mean "skip this bonus for this
 * encounter", not an error.
 */
export function buildPictureChoices(canonicalLetter: string, count = 3): PictureChoiceEntry[] | null {
  const target = ILLUSTRATED_WORDS.find((w) => w.letter === canonicalLetter);
  if (!target) return null;

  const distractorPool = shuffle(ILLUSTRATED_WORDS.filter((w) => w.letter !== canonicalLetter));
  const distractors = distractorPool.slice(0, count - 1);
  if (distractors.length < count - 1) return null;

  return shuffle([{ word: target, isTarget: true }, ...distractors.map((word) => ({ word, isTarget: false }))]);
}
