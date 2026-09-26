/**
 * Each letter's most common sound, as the game speaks it — letter-SOUND
 * correspondence (/b/), not the letter's name ("bee"), is what actually
 * predicts learning to read (see docs/02-pedagogy.md). Consonants and the
 * five SHORT vowels (a as in apple, e as in egg...), the sound a child
 * needs to sound out a CVC word like c-a-t.
 *
 * These are spelled-out approximations, because both the browser's
 * speech synthesis and the Gemini TTS pipeline (assets/generate-audio.mjs,
 * which reads this file) speak their input verbatim and have no way to
 * be handed a phoneme directly. Continuous sounds are stretched ("mmm",
 * "sss") and stop sounds carry the lightest possible vowel ("buh"),
 * which is how phonics teachers voice them too. A recorded clip in
 * public/audio/sounds/<LETTER>.wav always wins over this text — see
 * engine/audio.ts's speakLetterSound.
 */
export const LETTER_SOUND_SPELLING: Record<string, string> = {
  A: 'ah',
  B: 'buh',
  C: 'kuh',
  D: 'duh',
  E: 'eh',
  F: 'ffff',
  G: 'guh',
  H: 'huh',
  I: 'ih',
  J: 'juh',
  K: 'kuh',
  L: 'llll',
  M: 'mmmm',
  N: 'nnnn',
  O: 'aw',
  P: 'puh',
  Q: 'kwuh',
  R: 'rrrr',
  S: 'ssss',
  T: 'tuh',
  U: 'uh',
  V: 'vvvv',
  W: 'wuh',
  X: 'ks',
  Y: 'yuh',
  Z: 'zzzz',
};
