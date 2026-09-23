/**
 * A small, curated set of simple consonant-vowel-consonant words for
 * three/CvcWordRound.tsx — the "catch the letters in order and blend
 * them into a word" bonus. Deliberately short and common (no blends,
 * digraphs, or silent letters) since this is the very first step past
 * single-letter recognition into actual reading. Every word's 3 letters
 * are shown/tapped left to right, matching reading direction.
 */
export interface CvcWord {
  id: string;
  word: string;
  letters: [string, string, string];
}

export const CVC_WORDS: CvcWord[] = [
  { id: 'cat', word: 'CAT', letters: ['C', 'A', 'T'] },
  { id: 'dog', word: 'DOG', letters: ['D', 'O', 'G'] },
  { id: 'sun', word: 'SUN', letters: ['S', 'U', 'N'] },
  { id: 'bag', word: 'BAG', letters: ['B', 'A', 'G'] },
  { id: 'bed', word: 'BED', letters: ['B', 'E', 'D'] },
  { id: 'pig', word: 'PIG', letters: ['P', 'I', 'G'] },
  { id: 'hot', word: 'HOT', letters: ['H', 'O', 'T'] },
  { id: 'map', word: 'MAP', letters: ['M', 'A', 'P'] },
  { id: 'run', word: 'RUN', letters: ['R', 'U', 'N'] },
  { id: 'bus', word: 'BUS', letters: ['B', 'U', 'S'] },
  { id: 'cup', word: 'CUP', letters: ['C', 'U', 'P'] },
  { id: 'hat', word: 'HAT', letters: ['H', 'A', 'T'] },
  { id: 'web', word: 'WEB', letters: ['W', 'E', 'B'] },
  { id: 'red', word: 'RED', letters: ['R', 'E', 'D'] },
  { id: 'big', word: 'BIG', letters: ['B', 'I', 'G'] },
];

export function randomCvcWord(): CvcWord {
  return CVC_WORDS[Math.floor(Math.random() * CVC_WORDS.length)];
}
