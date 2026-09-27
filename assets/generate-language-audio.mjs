#!/usr/bin/env node
// Generates the recorded speech for a language pack via Gemini TTS — the
// multi-language counterpart of generate-audio.mjs (which stays the
// English generator; English clips keep their original paths).
//
// Usage (from assets/):
//   node generate-language-audio.mjs --lang=he --dry-run      # list every clip + its exact TTS text; no key needed
//   node generate-language-audio.mjs --lang=he                # generate missing clips (existing files are skipped)
//   node generate-language-audio.mjs --lang=he --only=letters # letters | sounds | words | pieces | colors | phrases | <clip id>
//   node generate-language-audio.mjs --lang=he --force        # regenerate even if the file exists
//
// Reads app/languages/<code>/pack.json and writes WAVs to
// app/public/audio/<code>/:
//   letters/<letterId>.wav   the letter's NAME   (letter.name)
//   sounds/<letterId>.wav    the letter's SOUND  (letter.sound; skipped when null)
//   words/<wordId>.wav       every word, blend word and missing-piece word (speak ?? text)
//   pieces/<choiceId>.wav    missing-piece choices (choice.speak)
//   colors/<colorId>.wav     rainbow colour words
//   phrases/<key>.wav        fixed phrases only — lines with {placeholders} or
//                            plural forms are composed at runtime and fall back
//                            to speech synthesis (docs/11-languages.md#audio)
//
// The TTS model reads its input VERBATIM (see generate-audio.mjs's promptFor
// comment): the text must be exactly what should be spoken. Write Hebrew and
// Arabic WITH vowel marks so the voice can't guess wrong; kana are read as
// written. A native speaker must listen to every clip (preview.mjs puts a
// player next to each item) — TTS voices mispronounce isolated letters and
// sounds more than words.
//
// Requires GEMINI_API_KEY in assets/.env (see .env.example). Free tier: a
// handful of requests per minute and ~10 per day for this model — a full
// language is 150–300 clips, so plan on a paid key or several days.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');

const TTS_MODEL = 'gemini-3.8-flash-tts';
// Gemini's prebuilt voices are multilingual; "Sulafat" (Warm) matches the English clips.
const VOICE_NAME = 'Sulafat';
const REQUEST_SPACING_MS = 21_000;
const MAX_RATE_LIMIT_RETRIES = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const parseRetryDelayMs = (err) => {
  const m = /"retryDelay":"([\d.]+)s"/.exec(err?.message ?? '');
  return m ? Math.ceil(parseFloat(m[1]) * 1000) : REQUEST_SPACING_MS;
};
const isDailyQuotaExhausted = (err) => /PerDay/i.test(err?.message ?? '');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    if (!(key in process.env)) process.env[key] = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
  }
}

function pcmToWav(pcm, sampleRate = 24000, channels = 1, bitDepth = 16) {
  if (pcm.subarray(0, 4).toString('ascii') === 'RIFF') return pcm;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE((sampleRate * channels * bitDepth) / 8, 28);
  header.writeUInt16LE((channels * bitDepth) / 8, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function buildClips(pack) {
  const out = join(APP, 'public', 'audio', pack.code);
  const clips = [];
  const add = (category, id, text) => {
    if (!text) return;
    clips.push({ id: `${category}:${id}`, category, text: text.normalize('NFC'), outPath: join(out, category, `${id}.wav`) });
  };
  for (const l of pack.letters) {
    add('letters', l.id, l.name);
    if (l.sound) add('sounds', l.id, l.sound);
  }
  const seenWords = new Set();
  const word = (id, text) => {
    if (seenWords.has(id)) return;
    seenWords.add(id);
    add('words', id, text);
  };
  for (const w of pack.words) word(w.id, w.speak ?? w.text);
  for (const w of pack.rounds.blend?.words ?? []) word(w.id, w.text);
  for (const w of pack.rounds.missingPiece?.words ?? []) word(w.id, w.text);
  for (const c of pack.rounds.missingPiece?.choices ?? []) add('pieces', c.id, c.speak);
  for (const c of pack.rounds.rainbow ?? []) add('colors', c.id, c.text);
  for (const [key, value] of Object.entries(pack.phrases ?? {})) {
    if (typeof value === 'string' && !/\{\w+\}/.test(value)) add('phrases', key, value);
  }
  return clips;
}

function parseArgs(argv) {
  const a = { dryRun: false, force: false, only: null, lang: null };
  for (const x of argv) {
    if (x === '--dry-run') a.dryRun = true;
    else if (x === '--force') a.force = true;
    else if (x.startsWith('--only=')) a.only = x.slice(7);
    else if (x.startsWith('--lang=')) a.lang = x.slice(7);
  }
  return a;
}

async function main() {
  loadEnvFile(join(HERE, '.env'));
  const args = parseArgs(process.argv.slice(2));
  if (!args.lang) {
    console.error('Usage: node generate-language-audio.mjs --lang=<code> [--dry-run] [--force] [--only=<category|clip id>]');
    process.exit(2);
  }
  if (args.lang === 'en') {
    console.error('English clips are generated by generate-audio.mjs and live at their original paths (public/audio/{letters,sounds,words}).');
    process.exit(2);
  }
  const packFile = join(APP, 'languages', args.lang, 'pack.json');
  if (!existsSync(packFile)) {
    console.error(`No pack at ${packFile}.`);
    process.exit(2);
  }
  const pack = JSON.parse(readFileSync(packFile, 'utf8'));
  if (JSON.stringify(pack).includes('TODO')) console.warn('Warning: the pack still has TODOs (run app/scripts/lang/validate.mjs). TODO text is skipped, but clips for unfinished entries would be wasted.');

  const clips = buildClips(pack).filter((c) => !/TODO/.test(c.text) && (!args.only || c.category === args.only || c.id === args.only || c.id.endsWith(`:${args.only}`)));
  if (clips.length === 0) {
    console.error(`No clips to generate${args.only ? ` for --only=${args.only}` : ''}.`);
    process.exit(1);
  }

  if (args.dryRun) {
    console.log(`${pack.name} (${pack.code}) — model ${TTS_MODEL}, voice ${VOICE_NAME}`);
    for (const c of clips) console.log(`${existsSync(c.outPath) ? '  (exists) ' : '           '}${c.id.padEnd(28)} ${c.text}`);
    const todo = clips.filter((c) => args.force || !existsSync(c.outPath)).length;
    console.log(`\n${clips.length} clip(s), ${todo} to generate (dry run — no API calls).`);
    return;
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error('Missing GEMINI_API_KEY in assets/.env (or run with --dry-run).');
    process.exit(1);
  }
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const results = { ok: 0, skipped: 0, failed: [] };

  for (const clip of clips) {
    if (!args.force && existsSync(clip.outPath)) {
      results.skipped++;
      continue;
    }
    mkdirSync(dirname(clip.outPath), { recursive: true });
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: TTS_MODEL,
          contents: [{ role: 'user', parts: [{ text: clip.text }] }],
          config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } } },
        });
        const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.mimeType?.startsWith('audio/'));
        if (!part) throw new Error('No audio in response');
        const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType ?? '')?.[1] ?? 24000);
        writeFileSync(clip.outPath, pcmToWav(Buffer.from(part.inlineData.data, 'base64'), rate));
        console.log(`[ok] ${clip.id} (${clip.text})`);
        results.ok++;
        break;
      } catch (err) {
        if (err?.status === 429 && isDailyQuotaExhausted(err)) {
          console.error(`\n[stopped] daily quota for ${TTS_MODEL} is used up. Rerun tomorrow — finished clips are skipped. (${results.ok} generated this run.)`);
          process.exit(1);
        }
        if (err?.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
          const wait = parseRetryDelayMs(err);
          console.warn(`[rate limited] ${clip.id}: waiting ${Math.round(wait / 1000)}s`);
          await sleep(wait);
          continue;
        }
        console.error(`[failed] ${clip.id}: ${err?.message ?? err}`);
        results.failed.push(clip.id);
        break;
      }
    }
    await sleep(REQUEST_SPACING_MS);
  }
  console.log(`\nDone: ${results.ok} generated, ${results.skipped} skipped, ${results.failed.length} failed${results.failed.length ? ` (${results.failed.join(', ')})` : ''}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
