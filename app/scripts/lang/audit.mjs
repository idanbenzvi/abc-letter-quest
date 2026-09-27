#!/usr/bin/env node
// Finds every place the app still assumes English / the Latin alphabet.
//
//   node app/scripts/lang/audit.mjs [--category=<id>] [--json] [--summary]
//
// It's the living checklist for the Phase 0 refactor (docs/11-languages.md):
// every hit is a spot that must read from the active language pack instead.
// After Phase 0, hits should remain only in places the doc says are fine
// (English-only features like the EMNIST handwriting check). Heuristic by
// design — it finds candidates, a human/Claude decides; rerun after each
// refactor step and the count must only go down.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { APP, parseArgs } from './lib.mjs';

const { flags } = parseArgs();

const CATEGORIES = [
  {
    id: 'english-data',
    title: 'Reads English content directly',
    fix: 'Route through the active pack (useLanguage()/getPack()): letters, words, cards, rounds.',
    files: /\.(ts|tsx)$/,
    re: /from '[./]*(data\/(curriculum|words|flashcards|letterSounds|cvcWords|vowelWords|initialSounds|confusablePairs|letterStrokes|zones)|engine\/letterNameMatch)'/,
  },
  {
    id: 'latin-regex',
    title: 'Latin-only character tests',
    fix: 'Test membership in the pack (letter chars/keys), or use Unicode property escapes (\\p{L}).',
    files: /\.(ts|tsx)$/,
    re: /\[a-zA-Z\]|\[A-Za-z\]|\[A-Z\]|\[a-z\]|\/\^\[A-Z|fromCharCode\(\s*65/,
  },
  {
    id: 'casing',
    title: 'Upper/lower case used as the second form',
    fix: 'Use pack forms (letter.secondary / the forms model) instead of toUpperCase/toLowerCase for LETTERS. Leave case-folding of free text (speech transcripts) alone.',
    files: /\.(ts|tsx)$/,
    re: /\.(toUpperCase|toLowerCase)\(\)/,
  },
  {
    id: 'locale',
    title: 'Hardcoded language/locale',
    fix: 'Use pack.locales.speechRecognition / speechSynthesis; for Intl APIs pass pack.code.',
    files: /\.(ts|tsx)$/,
    re: /'en-US'|'en-GB'|startsWith\('en'\)|lang = 'en|toLocale\w*\(\s*\)/,
  },
  {
    id: 'font',
    title: 'Latin-only font for letter shapes',
    fix: 'Canvas/SVG letter rendering must use pack.script.fonts.display (Nunito has no Hebrew/Arabic/CJK).',
    files: /\.(ts|tsx|css)$/,
    re: /Nunito|'Baloo 2'|Baloo 2,/,
  },
  {
    id: 'spoken-english',
    title: 'English spoken in code',
    fix: 'Move to pack.phrases (with {placeholders} and plural forms) and speak via a phrase helper.',
    files: /\.(ts|tsx)$/,
    re: /speak\(\s*[`'"][A-Za-z]|_PROMPT\s*=\s*'|parts\.push\([`'"][A-Z]/,
  },
  {
    id: 'ui-text',
    title: 'English UI text in JSX',
    fix: 'Extract to app/languages/<code>/ui.json keys via a t() helper (docs/11-languages.md#ui-strings).',
    files: /\.tsx$/,
    re: />\s*[A-Z][a-z]+(?:[ ,'’!?.-]+[A-Za-z]+){1,}[^<{]*</,
  },
  {
    id: 'ui-attr',
    title: 'English in labels/titles/placeholders',
    fix: 'Same as ui-text: aria-label, title, placeholder and alt must come from t().',
    files: /\.tsx$/,
    re: /(aria-label|title|placeholder|alt)=["'][A-Z][a-z]/,
  },
  {
    id: 'rtl-css',
    title: 'Physical CSS directions (mirror for RTL)',
    fix: 'Prefer logical properties: margin-inline-start, padding-inline-end, inset-inline-start, text-align: start.',
    files: /\.css$/,
    re: /(margin|padding|border)-(left|right)\s*:|(^|\s)(left|right)\s*:\s*[-\d]|text-align:\s*(left|right)|float:\s*(left|right)/,
  },
  {
    id: 'english-only-feature',
    title: 'English-only features (gate with pack.features)',
    fix: 'Keep, but only when pack.features.<flag> is true (EMNIST handwriting, typing, speech bonus).',
    files: /\.(ts|tsx)$/,
    re: /EMNIST|handwritingModel|classifyHandwriting|matchesLetter\(|listenOnce\(/,
  },
];

const SKIP_DIRS = new Set(['node_modules', 'lang', 'dist']);
const SKIP_FILES = /data\/letterStrokes\.ts$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(p, out);
    } else out.push(p);
  }
  return out;
}

const files = walk(join(APP, 'src')).filter((f) => !SKIP_FILES.test(f));
const results = [];
for (const cat of CATEGORIES) {
  if (flags.category && flags.category !== cat.id) continue;
  const hits = [];
  for (const f of files.filter((x) => cat.files.test(x))) {
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
      if (cat.re.test(line)) hits.push({ file: relative(APP, f), line: i + 1, text: trimmed.slice(0, 140) });
    });
  }
  results.push({ ...cat, re: String(cat.re), hits });
}

if (flags.json) {
  console.log(JSON.stringify(results, null, 2));
} else {
  let total = 0;
  for (const r of results) {
    total += r.hits.length;
    if (flags.summary) {
      console.log(`${String(r.hits.length).padStart(4)}  ${r.id.padEnd(22)} ${r.title}`);
      continue;
    }
    console.log(`\n■ ${r.title} [${r.id}] — ${r.hits.length} hit(s)\n  fix: ${r.fix}`);
    for (const h of r.hits) console.log(`  ${h.file}:${h.line}  ${h.text}`);
  }
  console.log(`\n${total} total. Rerun after each Phase 0 step; the number must only go down.`);
}
