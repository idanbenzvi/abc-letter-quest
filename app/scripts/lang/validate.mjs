#!/usr/bin/env node
// Validates a language pack: shape, cross-references, the content rules
// the game's rounds rely on, font coverage and stroke coverage.
//
//   node app/scripts/lang/validate.mjs <code> [--offline] [--json]
//
// --offline  skip the Google Fonts coverage check (needs network)
// --json     machine-readable report
//
// Exit code 1 when there are errors. Warnings never fail the run but
// should each be either fixed or explained in app/languages/<code>/NOTES.md.
// Every rule here is explained in docs/11-languages.md#validation-rules.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { APP, graphemes, loadPack, missingGlyphs, nfc, packDisplayText, parseArgs, sourceDir } from './lib.mjs';

const { flags, positional } = parseArgs();
const code = positional[0];
if (!code) {
  console.error('Usage: node app/scripts/lang/validate.mjs <code> [--offline] [--json]');
  process.exit(2);
}

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const pack = loadPack(code);
const en = code === 'en' ? pack : loadPack('en');

const SLUG = /^[a-z][a-z0-9_]*$/;
const ZWJ = '‍';
// Hangul syllables decompose (NFD) into conjoining jamo; map those back to
// the compatibility jamo (ㄱ ㅏ …) that packs use as letters.
const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNGSEONG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONGSEONG = 'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
const compatJamo = (s) =>
  s.replace(/[\u1100-\u1112\u1161-\u1175\u11a8-\u11c2]/g, (c) => {
    const cp = c.codePointAt(0);
    if (cp <= 0x1112) return CHOSEONG[cp - 0x1100];
    if (cp <= 0x1175) return JUNGSEONG[cp - 0x1161];
    return JONGSEONG[cp - 0x11a8];
  });
/** Base letters only: decompose, drop combining marks (niqqud, harakat, dakuten), unpack Hangul blocks, drop joiners and punctuation. */
const baseLetters = (s) => nfc(compatJamo(s.normalize('NFD').replace(/\p{M}/gu, ''))).replace(/[\u200c\u200d\s\-'’.]/g, '');
const firstBase = (s) => graphemes(baseLetters(s))[0] ?? '';
/** Does `text` begin with this letter (either form)? Compares both the raw first grapheme (が stays が) and its base (בָּ → ב). */
const startsWithLetter = (text, l) => {
  const firsts = [graphemes(nfc(text).replace(/[\u200c\u200d]/g, ''))[0] ?? '', firstBase(text)].map((c) => c.toLowerCase());
  const forms = [l.char, l.secondary].filter(Boolean).flatMap((c) => [c.replace(/\u200d/g, ''), firstBase(c)]).map((c) => c.toLowerCase());
  return firsts.some((c) => forms.includes(c));
};

// Any TODO left by the scaffolder is an error: the pack isn't done.
(function findTodos(value, where) {
  if (typeof value === 'string' && /\bTODO\b/.test(value)) err(where, `still TODO ("${value}")`);
  else if (Array.isArray(value)) value.forEach((v, i) => findTodos(v, `${where}[${i}]`));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) findTodos(v, where ? `${where}.${k}` : k);
})(pack, '');

// --- top level ----------------------------------------------------------
if (pack.schemaVersion !== 1) err('schemaVersion', 'must be 1');
if (pack.code !== code) err('code', `is "${pack.code}" but the folder is "${code}"`);
if (!['draft', 'reviewed'].includes(pack.status)) err('status', 'must be "draft" or "reviewed"');
if (pack.status === 'draft') warn('status', 'draft — a native speaker must review letters, words and audio before this ships (docs/languages/README.md#review)');

const s = pack.script ?? {};
const model = s.forms?.model;
if (!['ltr', 'rtl'].includes(s.direction)) err('script.direction', 'must be "ltr" or "rtl"');
if (!['case', 'final', 'positional', 'kana', 'none'].includes(model)) err('script.forms.model', 'must be case | final | positional | kana | none');
if (!['four-line', 'two-line', 'baseline', 'grid'].includes(s.writingGuide)) err('script.writingGuide', 'must be four-line | two-line | baseline | grid');
const box = s.forms?.introduceSecondaryFromBox;
if (!(Number.isInteger(box) && box >= 0 && box <= 4)) err('script.forms.introduceSecondaryFromBox', 'must be an integer 0–4');
for (const k of ['display', 'ui']) {
  const f = s.fonts?.[k];
  if (!f?.family || !Number.isInteger(f.weight)) err(`script.fonts.${k}`, 'needs { family, weight }');
}
if (!/^[a-z]{2,3}(-[A-Z]{2})?$/.test(pack.locales?.speechRecognition ?? '')) err('locales.speechRecognition', 'must look like "he-IL"');
if (!/^[a-z]{2,3}/.test(pack.locales?.speechSynthesis ?? '')) err('locales.speechSynthesis', 'must be a language prefix like "he"');
if (pack.features?.handwritingCheck && code !== 'en') err('features.handwritingCheck', 'the webcam check uses an English-only EMNIST model — must be false');
if (pack.features?.typing && model === 'kana') warn('features.typing', 'kana are typed through an IME (KeyboardEvent.key is "Process"), so typing a cloud will not work without a romaji buffer — see docs/languages/japanese.md');

// --- letters --------------------------------------------------------------
const letters = pack.letters ?? [];
const byId = new Map();
const byChar = new Map();
letters.forEach((l, i) => {
  const at = `letters[${i}] (${l.id ?? '?'})`;
  if (!SLUG.test(l.id ?? '')) err(at, 'id must be an ASCII slug like "alef"');
  if (byId.has(l.id)) err(at, `duplicate id "${l.id}"`);
  byId.set(l.id, l);
  if (typeof l.char !== 'string' || graphemes(l.char).length !== 1) err(at, `char must be exactly one grapheme, got "${l.char}"`);
  else if (l.char !== nfc(l.char)) err(at, 'char is not NFC-normalised');
  if (byChar.has(l.char)) err(at, `char "${l.char}" also used by ${byChar.get(l.char)}`);
  byChar.set(l.char, l.id);

  const sec = l.secondary;
  if (model === 'case' && (typeof sec !== 'string' || graphemes(sec).length !== 1)) err(at, 'forms model "case" needs a one-grapheme secondary (the lowercase letter)');
  if (model === 'kana' && (typeof sec !== 'string' || graphemes(sec).length !== 1)) err(at, 'forms model "kana" needs the katakana as secondary');
  if (model === 'none' && sec !== null) err(at, 'forms model "none" needs secondary: null');
  if (model === 'positional' && sec !== null && !(typeof sec === 'string' && sec === l.char + ZWJ)) err(at, `positional secondary must be the initial form written as char + U+200D ("${l.char}\\u200d"), or null for a non-joining letter`);
  if (model === 'final' && sec !== null && (typeof sec !== 'string' || graphemes(sec).length !== 1)) err(at, 'final form must be one grapheme or null');

  if (!l.name) err(at, 'name (spoken, for TTS) is required');
  if (!Array.isArray(l.nameAliases)) err(at, 'nameAliases must be an array');
  else if (pack.features?.speakLetter && l.nameAliases.length === 0) warn(at, 'no nameAliases — "say the letter" can never match it');
  if (!(l.sound === null || (typeof l.sound === 'string' && l.sound.length > 0))) err(at, 'sound must be text or null');
  if (!l.ipa) warn(at, 'ipa missing (reviewers rely on it)');
  if (!l.romanization) warn(at, 'romanization missing');
  if (l.keys && !Array.isArray(l.keys)) err(at, 'keys must be an array');
});
if (letters.length < 5) err('letters', `only ${letters.length} letters`);

// --- curriculum & chapters ------------------------------------------------
const curriculum = pack.curriculum ?? [];
const inCurriculum = new Set(curriculum);
if (inCurriculum.size !== curriculum.length) err('curriculum', 'lists a letter twice');
for (const id of curriculum) if (!byId.has(id)) err('curriculum', `unknown letter "${id}"`);
for (const l of letters) if (!inCurriculum.has(l.id)) err('curriculum', `letter "${l.id}" is never taught`);
const chapterTotal = (pack.chapters ?? []).reduce((n, c) => n + (c.size ?? 0), 0);
if (chapterTotal !== curriculum.length) err('chapters', `sizes add up to ${chapterTotal}, curriculum has ${curriculum.length}`);
for (const [i, c] of (pack.chapters ?? []).entries()) if (!SLUG.test(c.id?.replace(/-/g, '_') ?? '') || !c.name) err(`chapters[${i}]`, 'needs an id slug and a name');

// --- words ----------------------------------------------------------------
const words = pack.words ?? [];
const wordIds = new Set();
const wordsByLetter = new Map();
words.forEach((w, i) => {
  const at = `words[${i}] (${w.id ?? '?'})`;
  if (!SLUG.test(w.id ?? '')) err(at, 'id must be an ASCII slug');
  if (wordIds.has(w.id)) err(at, `duplicate id "${w.id}"`);
  wordIds.add(w.id);
  const l = byId.get(w.letter);
  if (!l) return err(at, `unknown letter "${w.letter}"`);
  if (!w.text || w.text !== nfc(w.text)) err(at, 'text missing or not NFC');
  if (!w.initialSound) err(at, 'initialSound is required (see docs/11-languages.md#sounds-not-letters)');
  if (!w.gloss) warn(at, 'gloss (English meaning) missing');
  if (w.text && !startsWithLetter(w.text, l)) warn(at, `filed under ${l.char} but starts with "${firstBase(w.text)}"`);
  if (w.art && !existsSync(join(APP, 'public/art/flashcards', `${w.art}.svg`)) && !existsSync(join(APP, 'public/art/flashcards', `${w.art}.jpg`))) warn(at, `art "${w.art}" doesn't exist yet in public/art/flashcards/ — generate it (docs/languages/README.md#pictures)`);
  (wordsByLetter.get(w.letter) ?? wordsByLetter.set(w.letter, []).get(w.letter)).push(w);
});
for (const l of letters) {
  const ws = wordsByLetter.get(l.id) ?? [];
  if (ws.length === 0) err(`letter ${l.id}`, 'has no words — every letter needs at least 2 (3 is better)');
  else if (ws.length < 2) warn(`letter ${l.id}`, `only ${ws.length} word`);
  const pictured = ws.filter((w) => w.art).length;
  if (ws.length && pictured === 0) warn(`letter ${l.id}`, 'no word has a picture — flash cards and storms need art');
}

// Odd-one-out storms need two cards of the target letter with the SAME first sound.
const soundKeys = new Set(words.map((w) => w.initialSound));
if (pack.rounds?.oddSound) {
  let hosts = 0;
  for (const [, ws] of wordsByLetter) {
    const counts = {};
    for (const w of ws.filter((x) => x.art)) counts[w.initialSound] = (counts[w.initialSound] ?? 0) + 1;
    if (Object.values(counts).some((n) => n >= 2)) hosts++;
  }
  if (hosts < letters.length / 2) warn('rounds.oddSound', `only ${hosts}/${letters.length} letters have two pictured words sharing a first sound — most letters will never get a storm`);
}
for (const [i, [a, b]] of (pack.confusableSounds ?? []).entries()) {
  for (const k of [a, b]) if (!soundKeys.has(k)) warn(`confusableSounds[${i}]`, `sound "${k}" isn't any word's initialSound`);
}

// --- look-alikes ------------------------------------------------------------
for (const [i, pair] of (pack.lookAlikes ?? []).entries()) {
  const [a, b] = pair ?? [];
  if (!byId.has(a) || !byId.has(b)) err(`lookAlikes[${i}]`, `unknown letter in [${a}, ${b}]`);
  if (a === b) err(`lookAlikes[${i}]`, 'pairs a letter with itself');
  if (pack.lookAlikeForm === 'secondary') for (const id of [a, b]) if (byId.get(id) && !byId.get(id).secondary) err(`lookAlikes[${i}]`, `lookAlikeForm is "secondary" but ${id} has no secondary form`);
}
if (!['primary', 'secondary'].includes(pack.lookAlikeForm)) err('lookAlikeForm', 'must be "primary" or "secondary"');

// --- rounds -------------------------------------------------------------------
const r = pack.rounds ?? {};
if (r.blend) {
  if ((r.blend.words ?? []).length < 5) warn('rounds.blend', `only ${(r.blend.words ?? []).length} words — the round repeats quickly`);
  for (const [i, w] of (r.blend.words ?? []).entries()) {
    const at = `rounds.blend.words[${i}] (${w.id})`;
    const unknown = (w.letters ?? []).filter((id) => !byId.has(id));
    if (unknown.length) { err(at, `unknown letters ${unknown.join(', ')}`); continue; }
    if ((w.letters ?? []).length < 2) err(at, 'needs at least 2 letters');
    const expected = w.letters.map((id) => firstBase(byId.get(id).char)).join('').toLowerCase();
    const actual = graphemes(baseLetters(w.text ?? '')).map((g) => {
      // A final form is the same letter: map it back to its primary.
      const owner = letters.find((l) => l.secondary && firstBase(l.secondary) === g);
      return owner ? firstBase(owner.char) : g;
    }).join('').toLowerCase();
    if (expected !== actual) warn(at, `letters spell "${expected}" but text reads "${actual}"`);
  }
} else if (r.blend !== null) err('rounds.blend', 'must be { words } or null');

if (r.missingPiece) {
  const choiceIds = new Set((r.missingPiece.choices ?? []).map((c) => c.id));
  if (choiceIds.size < 3) err('rounds.missingPiece.choices', 'needs at least 3 choices (the answer plus two drops)');
  for (const [i, c] of (r.missingPiece.choices ?? []).entries()) if (!c.text || !c.speak) err(`rounds.missingPiece.choices[${i}]`, 'needs text and speak');
  for (const [i, w] of (r.missingPiece.words ?? []).entries()) {
    const at = `rounds.missingPiece.words[${i}] (${w.id})`;
    if (!choiceIds.has(w.answer)) err(at, `answer "${w.answer}" isn't a choice`);
    if (!Number.isInteger(w.gap) || w.gap < 0 || w.gap >= (w.parts ?? []).length) err(at, 'gap must index into parts');
  }
  if ((r.missingPiece.words ?? []).length < 6) warn('rounds.missingPiece', 'fewer than 6 words');
} else if (r.missingPiece !== null) err('rounds.missingPiece', 'must be an object or null');

const RAINBOW_IDS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
const rainbowIds = (r.rainbow ?? []).map((c) => c.id);
if (RAINBOW_IDS.some((id) => !rainbowIds.includes(id)) || rainbowIds.length !== 6) err('rounds.rainbow', `needs exactly these six colours: ${RAINBOW_IDS.join(', ')}`);
for (const [i, c] of (r.rainbow ?? []).entries()) {
  if (!c.text) err(`rounds.rainbow[${i}]`, 'text missing');
  if (c.letter !== null && !byId.has(c.letter)) err(`rounds.rainbow[${i}]`, `unknown letter "${c.letter}"`);
  if (c.letter && byId.has(c.letter) && !startsWithLetter(c.text, byId.get(c.letter))) warn(`rounds.rainbow[${i}]`, `"${c.text}" doesn't start with ${byId.get(c.letter).char}`);
}

// --- phrases ------------------------------------------------------------------
const placeholders = (p) => new Set([...JSON.stringify(p).matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
const pluralCategories = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
for (const [key, enValue] of Object.entries(en.phrases ?? {})) {
  const v = pack.phrases?.[key];
  if (v === undefined) { err(`phrases.${key}`, 'missing (every English phrase key is required)'); continue; }
  const want = placeholders(enValue);
  const have = placeholders(v);
  for (const p of want) if (!have.has(p)) err(`phrases.${key}`, `missing placeholder {${p}}`);
  for (const p of have) if (!want.has(p)) err(`phrases.${key}`, `unknown placeholder {${p}}`);
  if (typeof enValue === 'object') {
    if (typeof v !== 'object' || !v.other) err(`phrases.${key}`, 'counted phrase: needs plural forms with at least "other"');
    else for (const cat of pluralCategories) if (!v[cat]) warn(`phrases.${key}`, `no "${cat}" form (Intl.PluralRules("${code}") uses: ${pluralCategories.join(', ')})`);
  }
}

// --- strokes ------------------------------------------------------------------
const strokesSrc = join(sourceDir(code), 'strokes.mjs');
if (!existsSync(strokesSrc)) warn('strokes', `no ${strokesSrc} — tracing and the writing page can't work (docs/languages/README.md#strokes)`);
else {
  try {
    const mod = await import(pathToFileURL(strokesSrc).href);
    const { loadTs } = await import('./lib.mjs');
    const { createStrokeKit } = await import('./stroke-kit.mjs');
    const forms = await mod.default(createStrokeKit(s.writingGuide), { loadTs });
    for (const l of letters) {
      for (const ch of [l.char, l.secondary].filter(Boolean)) {
        const st = forms[ch];
        if (!Array.isArray(st) || st.length === 0) err(`strokes`, `no strokes for "${ch}" (${l.id})`);
      }
    }
  } catch (e) {
    err('strokes', `strokes.mjs failed: ${e.message}`);
  }
}

// --- fonts (network) --------------------------------------------------------
if (!flags.offline) {
  try {
    const d = s.fonts.display;
    const missing = await missingGlyphs(d.family, d.weight, packDisplayText(pack));
    if (missing.length) err('script.fonts.display', `"${d.family}" ${d.weight} can't draw: ${missing.join(' ')} (${missing.map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(', ')})`);
    const u = s.fonts.ui;
    const phraseText = JSON.stringify(pack.phrases).replace(/\{\w+\}/g, '');
    const missingUi = await missingGlyphs(u.family, u.weight, letters.map((l) => l.char).join('') + phraseText.replace(/[{}":,\\]/g, ''));
    if (missingUi.length) err('script.fonts.ui', `"${u.family}" ${u.weight} can't draw: ${missingUi.join(' ')}`);
  } catch (e) {
    warn('fonts', `coverage not checked: ${e.message}`);
  }
}

// --- report --------------------------------------------------------------------
if (flags.json) {
  console.log(JSON.stringify({ code, errors, warnings }, null, 2));
} else {
  console.log(`Language pack "${code}" (${pack.name ?? '?'}): ${letters.length} letters, ${words.length} words`);
  if (errors.length) console.log(`\n${errors.length} error(s):\n  ✗ ${errors.join('\n  ✗ ')}`);
  if (warnings.length) console.log(`\n${warnings.length} warning(s):\n  ! ${warnings.join('\n  ! ')}`);
  if (!errors.length) console.log(`\nOK${warnings.length ? ' (with warnings)' : ''}.`);
}
process.exit(errors.length ? 1 : 0);
