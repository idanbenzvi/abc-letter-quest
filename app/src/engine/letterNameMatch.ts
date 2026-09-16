/**
 * Checks whether a transcribed utterance is the child SAYING THE
 * LETTER'S NAME aloud (e.g. "bee" for B) — a different question from
 * wordMatch.ts's matchesLetter, which checks whether a whole WORD
 * starts with a letter (e.g. "cat" for C). Speech recognizers commonly
 * transcribe a spoken letter name either as the bare letter itself or
 * as its nearest-homophone spelling, so this matches against a
 * curated list of both per letter rather than any phonetic algorithm.
 */
const LETTER_NAME_ALIASES: Record<string, string[]> = {
  A: ['a', 'ay', 'eh'],
  B: ['b', 'be', 'bee'],
  C: ['c', 'see', 'sea', 'si'],
  D: ['d', 'dee'],
  E: ['e', 'ee'],
  F: ['f', 'ef', 'eff'],
  G: ['g', 'gee'],
  H: ['h', 'aitch', 'aych', 'haitch'],
  I: ['i', 'eye', 'aye'],
  J: ['j', 'jay'],
  K: ['k', 'kay'],
  L: ['l', 'el', 'ell'],
  M: ['m', 'em'],
  N: ['n', 'en'],
  O: ['o', 'oh'],
  P: ['p', 'pee'],
  Q: ['q', 'cue', 'queue', 'kyoo'],
  R: ['r', 'are', 'ar'],
  S: ['s', 'es', 'ess'],
  T: ['t', 'tee', 'tea'],
  U: ['u', 'you', 'yew'],
  V: ['v', 'vee'],
  W: ['w', 'double u', 'double-u', 'doubleu', 'dubya'],
  X: ['x', 'ex', 'ecks'],
  Y: ['y', 'why'],
  Z: ['z', 'zee', 'zed'],
};

// The natural spoken form of each letter's name — "Bee", not "B". Handing
// a bare single character straight to SpeechSynthesisUtterance (as
// audio.ts's fallback used to) lets the platform TTS engine's own text
// normalizer decide how to read a lone letter, and several mobile voices
// (reported on a real phone, not assumed) resolve that by disambiguating
// case out loud — "Capital A" for the letter as displayed uppercase, just
// "a" for lowercase — which is correct for reading isolated text aloud
// but wrong here: the game only ever wants the letter's *name* spoken,
// never a description of which case it's drawn in. Spelling it out as an
// ordinary word sidesteps that normalizer entirely, on every platform.
const LETTER_SPOKEN_NAME: Record<string, string> = {
  A: 'Ay',
  B: 'Bee',
  C: 'See',
  D: 'Dee',
  E: 'Ee',
  F: 'Eff',
  G: 'Jee',
  H: 'Aitch',
  I: 'Eye',
  J: 'Jay',
  K: 'Kay',
  L: 'El',
  M: 'Em',
  N: 'En',
  O: 'Oh',
  P: 'Pee',
  Q: 'Cue',
  R: 'Ar',
  S: 'Ess',
  T: 'Tee',
  U: 'You',
  V: 'Vee',
  W: 'Double-you',
  X: 'Ex',
  Y: 'Why',
  Z: 'Zee',
};

/** Falls back to the letter itself for anything outside A-Z (shouldn't happen in practice). */
export function spokenLetterName(letter: string): string {
  return LETTER_SPOKEN_NAME[letter.toUpperCase()] ?? letter;
}

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesLetterName(transcript: string, letter: string): boolean {
  const aliases = LETTER_NAME_ALIASES[letter.toUpperCase()];
  if (!aliases) return false;
  const cleaned = normalize(transcript);
  if (!cleaned) return false;
  // Match the whole utterance, or just its first word — a recognizer
  // sometimes appends trailing noise ("bee period", a stray filler
  // word), and the whole point of this is being forgiving.
  const firstWord = cleaned.split(' ')[0];
  return aliases.includes(cleaned) || aliases.includes(firstWord);
}
