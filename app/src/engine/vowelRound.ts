import { VOWEL_WORDS, type VowelWord } from '../data/vowelWords';

export const VOWELS = ['A', 'E', 'I', 'O', 'U'] as const;

export interface VowelRound extends VowelWord {
  /** The missing middle vowel. */
  vowel: string;
  /** Three vowel raindrops (the right one + two others), in display order. */
  options: string[];
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

let lastId: string | null = null;

/** "C _ T — which sound is missing?" A random word (never the same one twice running), its vowel, and two other vowels as distractors. */
export function buildVowelRound(): VowelRound {
  const choices = VOWEL_WORDS.filter((w) => w.id !== lastId);
  const word = choices[Math.floor(Math.random() * choices.length)];
  lastId = word.id;
  const vowel = word.letters[1];
  const others = shuffle(VOWELS.filter((v) => v !== vowel)).slice(0, 2);
  return { ...word, vowel, options: shuffle([vowel, ...others]) };
}
