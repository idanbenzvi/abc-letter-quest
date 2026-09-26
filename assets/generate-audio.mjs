#!/usr/bin/env node
// Generates ABC Letter Quest SPOKEN AUDIO (26 letter names, 26 letter
// SOUNDS, and every flashcard/practice word) via the Gemini API's text-to-speech models,
// replacing the browser's built-in SpeechSynthesis as the primary voice
// (see docs/07-architecture.md#audio-strategy). Output is real recorded-
// quality speech in one consistent, warm, human voice, instead of
// whatever synthesis voice happens to be installed on the device.
//
// Usage:
//   node generate-audio.mjs --dry-run          # print what would be generated, no API calls, no key needed
//   node generate-audio.mjs                    # generate everything missing (skips files that already exist)
//   node generate-audio.mjs --force             # regenerate everything, overwriting existing clips
//   node generate-audio.mjs --only=letters      # just the 26 letter names
//   node generate-audio.mjs --only=sounds       # just the 26 letter sounds (/b/, not "bee")
//   node generate-audio.mjs --only=words        # just the words
//   node generate-audio.mjs --only=apple        # a single word/letter id
//
// Requires (for a real run): `npm install` in this directory, and a
// GEMINI_API_KEY in assets/.env (copy .env.example). Get a key at
// https://aistudio.google.com/apikey — double check the current TTS
// model id and pricing there before a large run; gemini-3.8-flash-tts
// is current as of Sep 2026 but this space moves fast (a fallback model
// id is noted below if it's ever retired).
//
// Unlike generate.mjs (images), this defaults to SKIPPING any clip whose
// output file already exists, rather than always overwriting — TTS is
// billed per call, and a half-finished/interrupted run is the normal
// case, not the exception. Pass --force to regenerate everything anyway.
//
// Source of truth: this script doesn't hand-duplicate the word list —
// it reads app/src/data/words.ts, app/src/data/flashcards.ts,
// app/src/data/cvcWords.ts, app/src/data/letterSounds.ts and
// app/src/engine/letterNameMatch.ts as
// plain text and regex-extracts id/word pairs straight out of them, so
// it can never drift out of sync with what the app actually shows and
// speaks.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = join(HERE, '..', 'app', 'src');
const OUT_LETTERS_DIR = join(HERE, '..', 'app', 'public', 'audio', 'letters');
const OUT_WORDS_DIR = join(HERE, '..', 'app', 'public', 'audio', 'words');
const OUT_SOUNDS_DIR = join(HERE, '..', 'app', 'public', 'audio', 'sounds');

// gemini-3.8-flash-tts is Google's current-generation TTS model (Sep
// 2026). If it's ever unavailable on your project, the older preview TTS
// models (e.g. gemini-2.5-flash-preview-tts) accept the same
// responseModalities/speechConfig shape used below — just swap this.
const TTS_MODEL = 'gemini-3.8-flash-tts';

// "Sulafat" is Google's own description for this prebuilt voice: Warm.
// Full voice list: https://ai.google.dev/gemini-api/docs/speech-generation
const VOICE_NAME = 'Sulafat';

// The free tier caps gemini-3.8-flash-tts at a handful of requests per
// minute (observed: 3/min — "generate_content_free_tier_requests" in the
// 429 body). Pacing every call this far apart keeps a full run from
// spending most of its time retrying instead of generating — a paid/
// higher-tier project can lower this safely. A 126-clip run at this
// pace takes roughly 45 minutes; that's expected, not a hang.
const REQUEST_SPACING_MS = 21_000;
const MAX_RATE_LIMIT_RETRIES = 5;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Reads the server's own suggested wait out of a 429 error body
 * (`"retryDelay":"3.9s"` inside the JSON-stringified error), so a
 * retry waits exactly as long as Google says to, not a guess. */
function parseRetryDelayMs(err) {
  const match = /"retryDelay":"([\d.]+)s"/.exec(err?.message ?? '');
  return match ? Math.ceil(parseFloat(match[1]) * 1000) : REQUEST_SPACING_MS;
}

/** A 429 can mean two very different things: "slow down" (a per-minute
 * rate limit — worth retrying, see MAX_RATE_LIMIT_RETRIES above) or
 * "come back tomorrow" (the free tier's PerDay quota — confirmed for
 * real: observed 10 requests/day total for this model, and retrying
 * against it just burns ~5 minutes per clip in dead-end backoff before
 * failing anyway). This tells the two apart from the quotaId Google
 * includes in the error body, so a daily cap aborts the whole run with
 * one clear message instead of retrying every remaining clip in turn. */
function isDailyQuotaExhausted(err) {
  return /PerDay/i.test(err?.message ?? '');
}

// gemini-3.8-flash-tts rejects a `systemInstruction` config field
// ("Developer instruction is not enabled for this model"), AND — unlike
// older Gemini TTS models, which would treat a leading "Say cheerfully: "
// clause as a non-spoken directive — treats generateContent's `text`
// part as a strict verbatim transcript: confirmed by an actual test
// call, where wrapping "Ay" in an instructional paragraph produced a
// 28-second clip of the model reading the whole paragraph aloud, not
// "Ay". So the text sent here must be *exactly* what should be spoken —
// no wrapper, no instruction, no quotes. Style/warmth steering for this
// model has a real supported channel (the Interactions API's
// `speech_metadata` annotation, kept separate from the transcript), but
// that's a bigger, less-verified change; for now, delivery comes from
// voice choice only (`VOICE_NAME` above, "Warm") rather than risking
// another bad batch on unverified prompt engineering.
function promptFor(text) {
  return text;
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

// --- Source-of-truth extraction -------------------------------------

/** Pulls { id, text } pairs out of array-literal source like
 * `{ id: 'apple', letter: 'A', word: 'Apple', ... }` (one entry per
 * line, id before word — true of words.ts, flashcards.ts, cvcWords.ts). */
function extractIdWordPairs(source) {
  const pairs = [];
  const re = /id:\s*'([^']+)'[^}\n]*?word:\s*'([^']+)'/g;
  for (const m of source.matchAll(re)) pairs.push({ id: m[1], text: m[2] });
  return pairs;
}

/** Pulls the `const LETTER_SPOKEN_NAME = { A: 'Ay', B: 'Bee', ... }` map
 * out of engine/letterNameMatch.ts — deliberately scoped to just that
 * block so it can't accidentally match LETTER_NAME_ALIASES above it
 * (which uses array values, not string values, so it wouldn't match
 * this regex anyway, but the scoping makes that non-accidental). */
function extractLetterSpokenNames(source) {
  const block = source.match(/LETTER_SPOKEN_NAME[^{]*\{([\s\S]*?)\};/);
  if (!block) throw new Error('Could not find LETTER_SPOKEN_NAME block in letterNameMatch.ts — did it move/get renamed?');
  const map = {};
  const re = /^\s*([A-Z]):\s*'([^']+)',?\s*$/gm;
  for (const m of block[1].matchAll(re)) map[m[1]] = m[2];
  return map;
}

/** Pulls the `LETTER_SOUND_SPELLING = { A: 'ah', B: 'buh', ... }` map out of data/letterSounds.ts. */
function extractLetterSoundSpellings(source) {
  const block = source.match(/LETTER_SOUND_SPELLING[^{]*\{([\s\S]*?)\};/);
  if (!block) throw new Error('Could not find LETTER_SOUND_SPELLING block in letterSounds.ts — did it move/get renamed?');
  const map = {};
  const re = /^\s*([A-Z]):\s*'([^']+)',?\s*$/gm;
  for (const m of block[1].matchAll(re)) map[m[1]] = m[2];
  return map;
}

function buildClips() {
  const letterNameSrc = readFileSync(join(APP_SRC, 'engine', 'letterNameMatch.ts'), 'utf8');
  const wordsSrc = readFileSync(join(APP_SRC, 'data', 'words.ts'), 'utf8');
  const flashcardsSrc = readFileSync(join(APP_SRC, 'data', 'flashcards.ts'), 'utf8');
  const cvcSrc = readFileSync(join(APP_SRC, 'data', 'cvcWords.ts'), 'utf8');
  const soundsSrc = readFileSync(join(APP_SRC, 'data', 'letterSounds.ts'), 'utf8');

  const letterNames = extractLetterSpokenNames(letterNameSrc);
  const letterClips = Object.entries(letterNames).map(([letter, text]) => ({
    id: letter,
    text,
    category: 'letters',
    outPath: join(OUT_LETTERS_DIR, `${letter}.wav`),
  }));

  const wordPairs = [
    ...extractIdWordPairs(wordsSrc),
    ...extractIdWordPairs(flashcardsSrc),
    ...extractIdWordPairs(cvcSrc),
  ];
  const seen = new Map(); // id -> text, first occurrence wins (e.g. CVC "cat"/"CAT" reuses words.ts's "Cat" clip)
  for (const { id, text } of wordPairs) {
    if (!seen.has(id)) seen.set(id, text);
  }
  const wordClips = [...seen.entries()].map(([id, text]) => ({
    id,
    text,
    category: 'words',
    outPath: join(OUT_WORDS_DIR, `${id}.wav`),
  }));

  // Letter SOUNDS — verbatim-transcript TTS can't be handed a phoneme,
  // so these are the spelled approximations from letterSounds.ts. Worth
  // a listen after generating: a clip that comes out as a letter NAME
  // ("eff" for "ffff") should be deleted and regenerated or recorded by hand.
  const soundClips = Object.entries(extractLetterSoundSpellings(soundsSrc)).map(([letter, text]) => ({
    id: `sound-${letter}`,
    text,
    category: 'sounds',
    outPath: join(OUT_SOUNDS_DIR, `${letter}.wav`),
  }));

  return [...letterClips, ...soundClips, ...wordClips];
}

// --- PCM -> WAV -------------------------------------------------------

/** Gemini TTS returns raw PCM (no container) for most models — wrap it
 * in a standard 44-byte RIFF/WAV header so <audio> can play it. If a
 * future model ever returns an already-complete WAV (starts with the
 * RIFF magic bytes), pass it through untouched instead of double-wrapping. */
function pcmToWav(pcm, sampleRate = 24000, channels = 1, bitDepth = 16) {
  if (pcm.subarray(0, 4).toString('ascii') === 'RIFF') return pcm;
  const byteRate = (sampleRate * channels * bitDepth) / 8;
  const blockAlign = (channels * bitDepth) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function sampleRateFromMime(mimeType) {
  const m = /rate=(\d+)/.exec(mimeType ?? '');
  return m ? Number(m[1]) : 24000;
}

// --- CLI ---------------------------------------------------------------

function parseArgs(argv) {
  const args = { dryRun: false, only: null, force: false };
  for (const a of argv) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
    else if (a.startsWith('--only=')) args.only = a.slice('--only='.length);
  }
  return args;
}

function matchesFilter(clip, only) {
  if (!only) return true;
  return clip.id === only || clip.category === only;
}

async function main() {
  loadEnvFile(join(HERE, '.env'));
  const { dryRun, only, force } = parseArgs(process.argv.slice(2));

  const clips = buildClips().filter((c) => matchesFilter(c, only));
  if (clips.length === 0) {
    console.error(`No clips matched --only=${only}`);
    process.exit(1);
  }

  if (dryRun) {
    console.log(`model: ${TTS_MODEL}, voice: ${VOICE_NAME}`);
    for (const clip of clips) {
      console.log(`\n=== ${clip.id} (${clip.category}) -> ${clip.outPath} ===`);
      console.log(promptFor(clip.text));
    }
    console.log(`\n${clips.length} clip(s) would be generated (dry run — no API calls made).`);
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('Missing GEMINI_API_KEY. Copy .env.example to .env and fill it in, or run with --dry-run to preview without a key.');
    process.exit(1);
  }
  mkdirSync(OUT_LETTERS_DIR, { recursive: true });
  mkdirSync(OUT_WORDS_DIR, { recursive: true });
  mkdirSync(OUT_SOUNDS_DIR, { recursive: true });

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const results = { ok: [], skipped: [], failed: [] };

  for (const clip of clips) {
    if (!force && existsSync(clip.outPath)) {
      results.skipped.push(clip.id);
      continue;
    }

    let attempt = 0;
    for (;;) {
      try {
        const response = await ai.models.generateContent({
          model: TTS_MODEL,
          contents: [{ role: 'user', parts: [{ text: promptFor(clip.text) }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
            },
          },
        });

        const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.mimeType?.startsWith('audio/'));
        if (!part) throw new Error('No audio returned in response');

        const raw = Buffer.from(part.inlineData.data, 'base64');
        const wav = pcmToWav(raw, sampleRateFromMime(part.inlineData.mimeType));
        writeFileSync(clip.outPath, wav);
        console.log(`[ok] ${clip.id} -> ${clip.outPath}`);
        results.ok.push(clip.id);
        break;
      } catch (err) {
        if (err?.status === 429 && isDailyQuotaExhausted(err)) {
          console.error(`\n[stopped] ${clip.id}: daily quota for ${TTS_MODEL} is exhausted for this API key/project.`);
          console.error('Retrying would not help — this resets on Google\'s schedule (typically ~24h), not by waiting longer right now.');
          console.error('Options: wait for the daily quota to reset and rerun (already-generated clips are skipped automatically);');
          console.error('enable billing on the project for a much higher quota; or point TTS_MODEL at a less-restricted model.');
          console.error(`Progress so far: ${results.ok.length} generated, ${results.skipped.length} skipped, ${results.failed.length} failed this run.`);
          process.exit(1);
        }

        // 429 = rate limited (the free tier caps this model at a
        // handful of requests/minute — see REQUEST_SPACING_MS below).
        // The API tells us exactly how long to wait in the error body's
        // retryDelay; honor that instead of guessing. Anything else
        // (a real 400, a malformed response, ...) is not retryable —
        // fail this clip and move on rather than looping forever.
        const retryMs = err?.status === 429 ? parseRetryDelayMs(err) : null;
        if (retryMs !== null && attempt < MAX_RATE_LIMIT_RETRIES) {
          attempt++;
          const waitMs = retryMs + 1000; // small buffer past what the server asked for
          console.warn(`[retry] ${clip.id}: rate limited, waiting ${Math.ceil(waitMs / 1000)}s (attempt ${attempt}/${MAX_RATE_LIMIT_RETRIES})`);
          await sleep(waitMs);
          continue;
        }
        console.error(`[fail] ${clip.id}: ${err.message}`);
        results.failed.push(clip.id);
        break;
      }
    }

    await sleep(REQUEST_SPACING_MS);
  }

  console.log(`\nDone. ${results.ok.length} generated, ${results.skipped.length} skipped (already existed), ${results.failed.length} failed.`);
  if (results.failed.length) console.log('Failed (rerun without --force to retry just these):', results.failed.join(', '));
}

main();
