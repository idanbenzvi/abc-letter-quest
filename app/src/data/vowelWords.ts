/**
 * Words for the Storm Vowels round (engine/vowelRound.ts): simple
 * consonant–SHORT-vowel–consonant words, the middle vowel being the part
 * of a CVC word beginning readers (and especially English learners —
 * English short vowels rarely match another language's) find hardest.
 *
 * `cardId` links a flash card's picture where one exists. Only nine of
 * these have art, and none for short e — so the round speaks the word
 * first and works as a listening task either way; the picture is a bonus.
 */
export interface VowelWord {
  id: string;
  letters: [string, string, string];
  cardId?: string;
}

export const VOWEL_WORDS: VowelWord[] = [
  { id: 'cat', letters: ['C', 'A', 'T'], cardId: 'cat' },
  { id: 'hat', letters: ['H', 'A', 'T'], cardId: 'hat' },
  { id: 'jam', letters: ['J', 'A', 'M'], cardId: 'jam' },
  { id: 'van', letters: ['V', 'A', 'N'], cardId: 'van' },
  { id: 'yak', letters: ['Y', 'A', 'K'], cardId: 'yak' },
  { id: 'map', letters: ['M', 'A', 'P'] },
  { id: 'bed', letters: ['B', 'E', 'D'] },
  { id: 'web', letters: ['W', 'E', 'B'] },
  { id: 'red', letters: ['R', 'E', 'D'] },
  { id: 'pig', letters: ['P', 'I', 'G'], cardId: 'pig' },
  { id: 'big', letters: ['B', 'I', 'G'] },
  { id: 'dog', letters: ['D', 'O', 'G'], cardId: 'dog' },
  { id: 'hot', letters: ['H', 'O', 'T'] },
  { id: 'sun', letters: ['S', 'U', 'N'], cardId: 'sun' },
  { id: 'nut', letters: ['N', 'U', 'T'], cardId: 'nut' },
  { id: 'bus', letters: ['B', 'U', 'S'] },
  { id: 'cup', letters: ['C', 'U', 'P'] },
];
