#!/usr/bin/env node
// Scaffolds a new language pack from a script profile.
//
//   node app/scripts/lang/new-language.mjs <code> --profile=<profile> [--force]
//   node app/scripts/lang/new-language.mjs --list
//
// Creates app/languages/<code>/:
//   pack.json    the pack, prefilled from the profile (letters, names, forms,
//                fonts, locales, look-alikes, rainbow colours); everything
//                that needs judgement is left "TODO" or empty
//   strokes.mjs  stroke-order template with one empty entry per form
//   NOTES.md     research log, decisions and native-speaker review record
//
// Then iterate with `node app/scripts/lang/validate.mjs <code>` until it's
// clean — its errors ARE the to-do list. See .claude/skills/add-language/SKILL.md.

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDir, loadPack, parseArgs, readJson, sourceDir, writeJson } from './lib.mjs';
import { GUIDE_METRICS } from './stroke-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILES = join(HERE, 'profiles');
const { flags, positional } = parseArgs();

if (flags.list) {
  for (const f of readdirSync(PROFILES).filter((n) => n.endsWith('.json'))) {
    const p = readJson(join(PROFILES, f));
    console.log(`${f.replace('.json', '').padEnd(20)} ${p.name.padEnd(10)} ${p.script.id}, ${p.script.direction}, forms: ${p.script.forms.model}, ${p.letters.length} letters`);
  }
  process.exit(0);
}

const code = positional[0];
const profileName = flags.profile;
if (!code || !profileName || !/^[a-z]{2,3}(-[a-z0-9]+)?$/.test(code)) {
  console.error('Usage: node app/scripts/lang/new-language.mjs <code> --profile=<profile> [--force]\n       node app/scripts/lang/new-language.mjs --list');
  process.exit(2);
}
const profilePath = join(PROFILES, `${profileName}.json`);
if (!existsSync(profilePath)) {
  console.error(`No profile "${profileName}". Available: ${readdirSync(PROFILES).map((n) => n.replace('.json', '')).join(', ')}.\nFor a new script, copy the closest profile to profiles/<script>.json and edit it (docs/languages/README.md#new-script).`);
  process.exit(2);
}
const dir = sourceDir(code);
if (existsSync(join(dir, 'pack.json')) && !flags.force) {
  console.error(`${dir}/pack.json already exists. Use --force to overwrite (NOTES.md and strokes.mjs are never overwritten).`);
  process.exit(2);
}

const profile = readJson(profilePath);
const en = loadPack('en');

// Phrases: every English key, marked TODO with the English as a guide;
// counted phrases get exactly the plural categories this language uses.
const categories = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
const phrases = {};
for (const [key, value] of Object.entries(en.phrases)) {
  if (typeof value === 'string') phrases[key] = `TODO: translate "${value}"`;
  else phrases[key] = Object.fromEntries(categories.map((c) => [c, `TODO: translate (${c}) "${value[c] ?? value.other}"`]));
}

// Chapters: 4–6 roughly equal slices, names left to the author.
const n = profile.letters.length;
const chapterCount = n <= 30 ? 4 : n <= 40 ? 5 : 6;
const chapters = Array.from({ length: chapterCount }, (_, i) => {
  const from = Math.round((i * n) / chapterCount);
  const to = Math.round(((i + 1) * n) / chapterCount);
  return { id: `chapter-${i + 1}`, name: `TODO: chapter ${i + 1} name`, size: to - from };
});

const pack = {
  schemaVersion: 1,
  code,
  name: profile.name,
  nativeName: profile.nativeName,
  status: 'draft',
  script: profile.script,
  locales: profile.locales,
  features: profile.features,
  letters: profile.letters,
  curriculum: profile.letters.map((l) => l.id),
  chapters,
  words: [],
  confusableSounds: [],
  lookAlikes: profile.lookAlikes,
  lookAlikeForm: profile.lookAlikeForm,
  rounds: {
    blend: { words: [] },
    missingPiece: null,
    oddSound: true,
    rainbow: profile.rainbow,
    planeChoice: true,
  },
  phrases,
};

ensureDir(dir);
writeJson(join(dir, 'pack.json'), pack);

const strokesPath = join(dir, 'strokes.mjs');
if (!existsSync(strokesPath)) {
  const g = profile.script.writingGuide;
  const m = GUIDE_METRICS[g];
  const entries = profile.letters
    .flatMap((l) => [l.char, l.secondary].filter(Boolean).map((ch) => `    ${JSON.stringify(ch)}: [], // ${l.id}${ch === l.char ? '' : ' (secondary)'} — TODO`))
    .join('\n');
  writeFileSync(
    strokesPath,
    `// Stroke order for ${profile.name}: one SVG path per pen stroke, in teaching
// order, each drawn in its writing direction. Guide "${g}", viewBox ${m.viewBox.join(' ')},
// lines ${JSON.stringify(m.lines)}.
//
// Author every stroke yourself with the kit (app/scripts/lang/stroke-kit.mjs) —
// never copy stroke data from another project (licensing: docs/languages/README.md#strokes).
// Check each letter in the preview: node app/scripts/lang/build-strokes.mjs ${code} --preview
//
// Kit: line(p1, p2, ...), arc(cx, cy, rx, ry, fromClockDeg, toClockDeg),
//      ring(cx, cy, rx, ry, startDeg, ccw), pen(p).line(p).quad(c, p).cubic(c1, c2, p).arc(...).done(),
//      dot(x, y), ept(cx, cy, rx, ry, clockDeg) -> [x, y], lines = ${JSON.stringify(m.lines)}

export default function strokes(kit) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { line, arc, ring, pen, dot, ept, lines } = kit;
  return {
${entries}
  };
}
`,
  );
}

const notesPath = join(dir, 'NOTES.md');
if (!existsSync(notesPath)) {
  writeFileSync(
    notesPath,
    `# ${profile.name} (${code}) — research, decisions and review

Scaffolded from the \`${profileName}\` profile. Keep this file current: it is
how the next session (and the native-speaker reviewer) knows why the pack
looks the way it does. See docs/languages/README.md and the script guide in
docs/languages/ for what each decision involves.

## Sources
- (curricula, word-frequency lists, children's books consulted — with links)

## Decisions
- **Teaching order (curriculum):** why this order.
- **Letter sounds:** how a lone letter's sound is spelled for TTS, and which letters have none.
- **Second form:** when it appears (introduceSecondaryFromBox) and why.
- **Words:** selection rules used (picturable, known to a 4–6 year old, unambiguous first sound…).
- **Rounds:** which rounds are on, and what the blend / missing-piece rounds use in this language.
- **Fonts:** display and UI font choice, and the coverage check result.
- **Dialect / register:** e.g. MSA vs spoken Arabic, which TTS voice.

## Known warnings (validate.mjs), each explained
- …

## Native-speaker review
| Date | Reviewer | Scope (letters / words / audio / strokes) | Result |
|------|----------|-------------------------------------------|--------|
`,
  );
}

console.log(`Scaffolded ${dir} from profile "${profileName}" (${profile.letters.length} letters, ${chapterCount} chapters).
Next:
  1. Read docs/languages/README.md and the ${profile.script.id} guide in docs/languages/.
  2. node app/scripts/lang/validate.mjs ${code}   — its errors are your to-do list.
  3. Fill words, sounds, phrases and chapters in pack.json; author strokes.mjs.
  4. node app/scripts/lang/build.mjs ${code}      — generates the app files, cards and the review sheet.`);
