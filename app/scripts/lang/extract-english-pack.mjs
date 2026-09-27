#!/usr/bin/env node
// Builds app/languages/en/pack.json from the game's CURRENT English data
// files — the reference pack every other language is modelled on, and the
// behaviour target for the Phase 0 refactor (docs/11-languages.md): once
// the game reads packs, running it from this file must look and sound
// exactly like today's hardcoded English.
//
// Rerun after changing any English data file:
//   node app/scripts/lang/extract-english-pack.mjs [--check]
// --check: exit 1 if pack.json is out of date instead of writing it.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP, loadTs, packPath, parseArgs, writeJson } from './lib.mjs';

const { flags } = parseArgs();

const [{ CURRICULUM_ORDER }, { ZONES }, { WORDS }, { FLASHCARDS }, sounds, { LETTER_SOUND_SPELLING }, names, { CONFUSABLE_LETTER_PAIRS }, { CVC_WORDS }, { VOWEL_WORDS }, { RAINBOW_COLORS }] = await Promise.all([
  loadTs('src/data/curriculum.ts'),
  loadTs('src/data/zones.ts'),
  loadTs('src/data/words.ts'),
  loadTs('src/data/flashcards.ts'),
  loadTs('src/data/initialSounds.ts'),
  loadTs('src/data/letterSounds.ts'),
  loadTs('src/engine/letterNameMatch.ts'),
  loadTs('src/data/confusablePairs.ts'),
  loadTs('src/data/cvcWords.ts'),
  loadTs('src/data/vowelWords.ts'),
  loadTs('src/engine/rainbowChoice.ts'),
]);

// LETTER_NAME_ALIASES isn't exported; read it from source.
const nameSrc = readFileSync(join(APP, 'src/engine/letterNameMatch.ts'), 'utf8');
const aliasBlock = /LETTER_NAME_ALIASES[^{]*\{([\s\S]*?)\n\};/.exec(nameSrc)?.[1];
if (!aliasBlock) throw new Error('LETTER_NAME_ALIASES not found in engine/letterNameMatch.ts');
const aliases = {};
for (const m of aliasBlock.matchAll(/^\s*([A-Z]):\s*\[([^\]]*)\]/gm)) aliases[m[1]] = [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1]);

const hasArt = (id) => existsSync(join(APP, 'public/art/flashcards', `${id}.svg`)) || existsSync(join(APP, 'public/art/flashcards', `${id}.jpg`));
const idOf = (letter) => letter.toLowerCase();

const ipaByLetter = {};
for (const w of WORDS) ipaByLetter[w.letter] ??= w.phoneme;

const letters = CURRICULUM_ORDER.map((L) => ({
  id: idOf(L),
  char: L,
  secondary: L.toLowerCase(),
  name: names.spokenLetterName(L),
  nameAliases: aliases[L] ?? [],
  sound: LETTER_SOUND_SPELLING[L] ?? null,
  ipa: ipaByLetter[L] ?? '',
  romanization: L.toLowerCase(),
}));

// Flash cards first (they carry the art and drive the storms), then any
// practice word that has no card.
const words = [];
const seen = new Set();
for (const c of FLASHCARDS) {
  seen.add(c.id);
  words.push({ id: c.id, letter: idOf(c.letter), text: c.word, initialSound: sounds.initialSoundOf(c.id), ...(hasArt(c.id) ? { art: c.id } : {}), gloss: c.word });
}
for (const w of WORDS) {
  if (seen.has(w.id)) continue;
  seen.add(w.id);
  words.push({ id: w.id, letter: idOf(w.letter), text: w.word, initialSound: w.letter.toLowerCase(), ...(hasArt(w.id) ? { art: w.id } : {}), gloss: w.word });
}

const VOWELS = ['A', 'E', 'I', 'O', 'U'];

const pack = {
  schemaVersion: 1,
  code: 'en',
  name: 'English',
  nativeName: 'English',
  status: 'reviewed',
  script: {
    id: 'latin',
    direction: 'ltr',
    forms: { model: 'case', primaryLabel: 'Uppercase', secondaryLabel: 'Lowercase', introduceSecondaryFromBox: 2 },
    fonts: { display: { family: 'Nunito', weight: 900 }, ui: { family: 'Nunito', weight: 400 } },
    writingGuide: 'four-line',
  },
  locales: { speechRecognition: 'en-US', speechSynthesis: 'en' },
  features: { handwritingCheck: true, typing: true, speakLetter: true, ownWord: true },
  letters,
  curriculum: CURRICULUM_ORDER.map(idOf),
  chapters: ZONES.map((z) => ({ id: z.id, name: z.name, size: z.letters.length })),
  words,
  confusableSounds: sounds.CONFUSABLE_SOUNDS,
  lookAlikes: CONFUSABLE_LETTER_PAIRS.map(([a, b]) => [idOf(a), idOf(b)]),
  lookAlikeForm: 'secondary',
  rounds: {
    blend: { words: CVC_WORDS.map((w) => ({ id: w.id, letters: w.letters.map(idOf), text: w.word, gloss: w.word.toLowerCase(), ...(hasArt(w.id) ? { art: w.id } : {}) })) },
    missingPiece: {
      choices: VOWELS.map((v) => ({ id: idOf(v), text: v, speak: LETTER_SOUND_SPELLING[v] })),
      words: VOWEL_WORDS.map((w) => ({ id: w.id, parts: [...w.letters], gap: 1, answer: idOf(w.letters[1]), text: w.letters.join(''), gloss: w.id, ...(w.cardId ? { art: w.cardId } : {}) })),
    },
    oddSound: true,
    rainbow: RAINBOW_COLORS.map((c) => ({ id: c.id, text: c.word, letter: CURRICULUM_ORDER.includes(c.word[0]) ? idOf(c.word[0]) : null })),
    planeChoice: true,
  },
  // Hardcoded today in three/FlightGameScreen.tsx and screens/Nest.tsx.
  phrases: {
    rainbowPrompt: 'Which colour is glowing?',
    stormPrompt: 'Which one starts with a different sound?',
    missingPiecePrompt: 'Which sound is missing?',
    listenWord: 'Listen: {word}',
    bothStartWith: '{a} and {b} both start with',
    nestEggsWarming: 'Your eggs are warming up! Catch letters on your flights to hatch them.',
    nestHatched: { one: "You've hatched {count} letter!", other: "You've hatched {count} letters!" },
    nestNewChicks: { one: 'New chick: {list}!', other: 'New chicks: {list}!' },
    nestMoreToCompanion: '{count} more and a {companion} joins your flock!',
    nestWholeFlock: 'Your whole flock is here!',
  },
};

const path = packPath('en');
const next = JSON.stringify(pack, null, 2) + '\n';
if (flags.check) {
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (current !== next) {
    console.error('app/languages/en/pack.json is out of date with the English data files. Run: node app/scripts/lang/extract-english-pack.mjs');
    process.exit(1);
  }
  console.log('en pack is up to date.');
} else {
  writeJson(path, pack);
  console.log(`Wrote ${path}: ${letters.length} letters, ${words.length} words (${words.filter((w) => w.art).length} with art), ${pack.rounds.blend.words.length} blend words, ${pack.rounds.missingPiece.words.length} missing-piece words.`);
}
