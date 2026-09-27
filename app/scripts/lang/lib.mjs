// Shared helpers for the language-pack scripts (app/scripts/lang/*.mjs).
// See docs/11-languages.md. Plain Node (18+), no dependencies beyond the
// esbuild that Vite already installs.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
export const APP = resolve(HERE, '..', '..');
export const REPO = resolve(APP, '..');
export const LANGUAGES_DIR = join(APP, 'languages');
export const CACHE_DIR = join(HERE, '.cache');
export const OUT_DIR = join(HERE, 'out');

/** Authored source for a language: app/languages/<code>/. */
export const sourceDir = (code) => join(LANGUAGES_DIR, code);
/** Generated, app-importable output: app/src/lang/<code>/. */
export const generatedDir = (code) => join(APP, 'src', 'lang', code);
export const packPath = (code) => join(sourceDir(code), 'pack.json');

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export function loadPack(code) {
  const path = packPath(code);
  if (!existsSync(path)) throw new Error(`No pack at ${path}. Scaffold one with: node app/scripts/lang/new-language.mjs ${code} --profile=<profile>`);
  return readJson(path);
}

/** Parses `--flag`, `--key=value` and positionals. */
export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  const positional = [];
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq === -1) flags[a.slice(2)] = true;
      else flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else positional.push(a);
  }
  return { flags, positional };
}

/**
 * Imports one of the app's TypeScript modules (with its own imports) by
 * bundling it with esbuild into a temp .mjs file. Lets scripts read the
 * real data files instead of regex-scraping them. Browser-only code
 * paths must not run at import time (the data modules don't).
 */
export async function loadTs(relPathFromApp) {
  const { build } = await import(pathToFileURL(join(APP, 'node_modules', 'esbuild', 'lib', 'main.js')).href);
  const entry = join(APP, relPathFromApp);
  const result = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent', loader: { '.json': 'json' } });
  const code = result.outputFiles[0].text;
  const file = join(tmpdir(), `lang-kit-${createHash('sha1').update(entry + code).digest('hex').slice(0, 12)}.mjs`);
  writeFileSync(file, code);
  return import(pathToFileURL(file).href);
}

export const nfc = (s) => (typeof s === 'string' ? s.normalize('NFC') : s);

/** User-perceived characters (grapheme clusters), so "בּ" or "が" count as one. */
export function graphemes(s) {
  return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s), (x) => x.segment);
}

/** Every code point in a string, minus joiners/marks that fonts needn't map on their own. */
export function codePoints(s) {
  return Array.from(s)
    .map((c) => c.codePointAt(0))
    .filter((cp) => cp !== 0x200d && cp !== 0x200c && cp !== 0x20);
}

export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Every piece of target-script text the game will render for a pack — what the display font must cover. */
export function packDisplayText(pack) {
  const bits = [];
  for (const l of pack.letters) bits.push(l.char, l.secondary ?? '');
  for (const w of pack.words) bits.push(w.text);
  for (const w of pack.rounds.blend?.words ?? []) bits.push(w.text);
  for (const c of pack.rounds.missingPiece?.choices ?? []) bits.push(c.text);
  for (const w of pack.rounds.missingPiece?.words ?? []) bits.push(w.text, ...w.parts);
  for (const c of pack.rounds.rainbow ?? []) bits.push(c.text);
  for (const ch of pack.chapters ?? []) bits.push(ch.name);
  return bits.join('');
}

// --- Google Fonts: fetch a real TTF and read its character map ---------

/**
 * Downloads the TTF Google Fonts serves for `family`/`weight`. An old
 * User-Agent makes the CSS2 API answer with one full, unsubsetted
 * truetype file instead of per-script woff2 slices, so its cmap tells
 * the whole truth. Cached in app/scripts/lang/.cache/.
 */
export async function fetchGoogleFont(family, weight = 400) {
  ensureDir(CACHE_DIR);
  const cacheFile = join(CACHE_DIR, `${family.replace(/\W+/g, '_')}-${weight}.ttf`);
  if (existsSync(cacheFile)) return readFileSync(cacheFile);
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weight}`;
  const cssRes = await fetch(cssUrl, { headers: { 'User-Agent': 'Mozilla/4.0' } });
  if (!cssRes.ok) throw new Error(`Google Fonts has no "${family}" at weight ${weight} (${cssRes.status}). Check the exact family name and available weights at https://fonts.google.com.`);
  const css = await cssRes.text();
  const url = /url\((https:[^)]+\.ttf)\)/.exec(css)?.[1];
  if (!url) throw new Error(`No TTF URL in the Google Fonts CSS for "${family}" ${weight}.`);
  const fontRes = await fetch(url);
  if (!fontRes.ok) throw new Error(`Font download failed: ${url} (${fontRes.status})`);
  const buf = Buffer.from(await fontRes.arrayBuffer());
  writeFileSync(cacheFile, buf);
  return buf;
}

/** Code points a TrueType/OpenType font maps (cmap formats 4 and 12). */
export function fontCodePoints(buf) {
  const numTables = buf.readUInt16BE(4);
  let cmapOffset = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (buf.toString('ascii', rec, rec + 4) === 'cmap') cmapOffset = buf.readUInt32BE(rec + 8);
  }
  if (cmapOffset < 0) throw new Error('Font has no cmap table');
  const covered = new Set();
  const subtables = buf.readUInt16BE(cmapOffset + 2);
  for (let i = 0; i < subtables; i++) {
    const rec = cmapOffset + 4 + i * 8;
    const platform = buf.readUInt16BE(rec);
    const encoding = buf.readUInt16BE(rec + 2);
    const off = cmapOffset + buf.readUInt32BE(rec + 4);
    if (platform !== 3 && platform !== 0) continue;
    const format = buf.readUInt16BE(off);
    if (format === 4) {
      const segX2 = buf.readUInt16BE(off + 6);
      const ends = off + 14;
      const starts = ends + segX2 + 2;
      const deltas = starts + segX2;
      const rangeOffsets = deltas + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = buf.readUInt16BE(ends + s * 2);
        const start = buf.readUInt16BE(starts + s * 2);
        const delta = buf.readInt16BE(deltas + s * 2);
        const ro = buf.readUInt16BE(rangeOffsets + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let glyph;
          if (ro === 0) glyph = (c + delta) & 0xffff;
          else {
            const g = buf.readUInt16BE(rangeOffsets + s * 2 + ro + (c - start) * 2);
            glyph = g === 0 ? 0 : (g + delta) & 0xffff;
          }
          if (glyph !== 0) covered.add(c);
        }
      }
    } else if (format === 12 && (platform === 0 || encoding === 10)) {
      const groups = buf.readUInt32BE(off + 12);
      for (let g = 0; g < groups; g++) {
        const base = off + 16 + g * 12;
        const start = buf.readUInt32BE(base);
        const end = buf.readUInt32BE(base + 4);
        const startGlyph = buf.readUInt32BE(base + 8);
        for (let c = start; c <= end; c++) if (startGlyph + (c - start) !== 0) covered.add(c);
      }
    }
  }
  return covered;
}

/** Characters of `text` the font can't draw (as strings, deduplicated). */
export async function missingGlyphs(family, weight, text) {
  const covered = fontCodePoints(await fetchGoogleFont(family, weight));
  const missing = new Set();
  for (const cp of codePoints(text)) if (!covered.has(cp)) missing.add(String.fromCodePoint(cp));
  return [...missing];
}

export function googleFontsCssHref(fonts) {
  const families = fonts.map((f) => `family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:wght@${f.weight}`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=block`;
}
