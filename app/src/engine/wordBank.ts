import type { WordEntry } from '../types';
import { WORDS_BY_LETTER } from '../data/words';

/**
 * Picks a word to practice for a letter, avoiding the word shown last
 * time for that letter (when there's a choice) so repeated review
 * doesn't feel like the same flashcard every session.
 */
export function pickWordForLetter(letter: string, lastWordId: string | null): WordEntry {
  const options = WORDS_BY_LETTER[letter] ?? [];
  if (options.length === 0) {
    throw new Error(`No words defined for letter ${letter}`);
  }
  const pool = options.length > 1 ? options.filter((w) => w.id !== lastWordId) : options;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** For display (e.g. the dashboard): the word last practiced for this letter, or its first word if never practiced. */
export function displayWordForLetter(letter: string, lastWordId: string | null): WordEntry {
  const options = WORDS_BY_LETTER[letter] ?? [];
  return options.find((w) => w.id === lastWordId) ?? options[0];
}
