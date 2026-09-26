import { FLASHCARDS } from './flashcards';

/**
 * The first SOUND of every flash-card word — what the storm's "odd one
 * out" round (engine/oddSound.ts) compares. Usually that's just the
 * card's letter, but not always, and a round built on letters alone
 * could ask an unanswerable question ("Cat, Car, Kite": all /k/). Every
 * card was audited by hand; these are the exceptions:
 */
const SOUND_OVERRIDES: Record<string, string> = {
  // C and K cards all start with /k/.
  cat: 'k',
  cake: 'k',
  car: 'k',
  kite: 'k',
  key: 'k',
  kangaroo: 'k',
  // /kw/ — close enough to /k/ that the two are never contrasted (see CONFUSABLE_SOUNDS).
  queen: 'kw',
  quilt: 'kw',
  // Filed under U/X, but they start with /y/, /z/ and short /e/.
  unicorn: 'y',
  xylophone: 'z',
  xray: 'e',
};

/** A card's first sound, as a key: a lowercase letter whose own sound it is, or 'kw'. */
export function initialSoundOf(cardId: string): string {
  if (SOUND_OVERRIDES[cardId]) return SOUND_OVERRIDES[cardId];
  const card = FLASHCARDS.find((c) => c.id === cardId);
  return card ? card.letter.toLowerCase() : '';
}

/** The letter whose sound (engine/audio.ts's speakLetterSound) voices a sound key — 'k' → K, 'kw' → Q. */
export function letterForSound(sound: string): string {
  return sound === 'kw' ? 'Q' : sound.toUpperCase();
}

/**
 * Sound pairs too close to contrast for a 4–6 year old (voiced/voiceless
 * twins, nasals, neighbouring short vowels). An odd-one-out card never
 * comes from a sound paired here with the matching pair's sound.
 */
export const CONFUSABLE_SOUNDS: [string, string][] = [
  ['b', 'p'],
  ['d', 't'],
  ['g', 'k'],
  ['f', 'v'],
  ['s', 'z'],
  ['m', 'n'],
  ['k', 'kw'],
  ['a', 'e'],
  ['e', 'i'],
  ['a', 'u'],
  ['o', 'u'],
];
