#!/usr/bin/env node
// Builds a language's flash cards.
//
//   node app/scripts/lang/build-flashcards.mjs <code> [--art-manifest]
//
// For every pack word with a picture, writes two card SVGs to
// app/public/art/flashcards/<code>/: <id>-card.svg (word hidden) and
// <id>-revealed.svg (word shown, first letter highlighted), plus
// app/src/lang/<code>/cards.generated.ts listing them in the FlashCardDef
// shape (data/flashcards.ts).
//
// Pictures are language-neutral and shared: a word's `art` concept reuses
// app/public/art/flashcards/<art>.jpg (AI art) or <art>.svg (hand-drawn
// icon). --art-manifest writes app/scripts/lang/out/<code>-art-manifest.json:
// assets/manifest.json-style entries for every word that has no picture
// yet, to merge into assets/manifest.json and generate with
// assets/generate.mjs (docs/languages/README.md#pictures).
//
// Same card design as app/scripts/generate-flashcards.mjs. Card text is
// SVG <text>: when the game rasterises a card (three/flashCardTexture.ts)
// web fonts aren't available inside an SVG image, so the font stack below
// ends in script-appropriate system fonts. See docs/11-languages.md#cards.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP, ensureDir, escapeHtml, generatedDir, graphemes, loadPack, OUT_DIR, parseArgs, writeJson } from './lib.mjs';

const { flags, positional } = parseArgs();
const code = positional[0];
if (!code) {
  console.error('Usage: node app/scripts/lang/build-flashcards.mjs <code> [--art-manifest]');
  process.exit(2);
}
const pack = loadPack(code);
const ART = join(APP, 'public/art/flashcards');
const OUT = ensureDir(join(ART, code));
const rtl = pack.script.direction === 'rtl';
const joining = pack.script.id === 'arabic';

/** System fonts that cover each script, after the pack's own display font. */
const SYSTEM_FALLBACKS = {
  latin: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  cyrillic: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  hebrew: "'Arial Hebrew', 'Noto Sans Hebrew', 'Segoe UI', Arial, sans-serif",
  arabic: "'Geeza Pro', 'Noto Naskh Arabic', 'Segoe UI', Tahoma, sans-serif",
  kana: "'Hiragino Maru Gothic ProN', 'Hiragino Sans', 'Noto Sans JP', 'Yu Gothic', 'Meiryo', sans-serif",
  hangul: "'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif",
};
const fontStack = `'${pack.script.fonts.display.family}', ${SYSTEM_FALLBACKS[pack.script.id] ?? 'system-ui, sans-serif'}`;
const fontWeight = Math.min(900, Math.max(600, pack.script.fonts.display.weight));

function artFor(word) {
  if (!word.art) return null;
  if (existsSync(join(ART, `${word.art}.jpg`))) return { kind: 'jpg', href: `/art/flashcards/${word.art}.jpg` };
  if (existsSync(join(ART, `${word.art}.svg`))) {
    const inner = /<svg[^>]*>([\s\S]*)<\/svg>/i.exec(readFileSync(join(ART, `${word.art}.svg`), 'utf8'))?.[1];
    if (inner) return { kind: 'svg', inner };
  }
  return null;
}

/**
 * The revealed word, with its first letter in coral. Arabic letters join,
 * and splitting a word into <tspan>s breaks the joining — so the first
 * letter's tspan ends with a ZWJ and the rest starts with one, which keeps
 * both halves in their connected shapes.
 */
function wordMarkup(text) {
  const g = graphemes(text);
  const first = g[0] ?? '';
  const rest = g.slice(1).join('');
  if (joining) return `<tspan fill="#e26a57">${escapeHtml(first)}‍</tspan>‍${escapeHtml(rest)}`;
  return `<tspan fill="#e26a57">${escapeHtml(first)}</tspan>${escapeHtml(rest)}`;
}

/** Shrink long words to fit the 140-unit banner (a rough per-script width estimate). */
function wordFontSize(text) {
  const units = graphemes(text).reduce((n, g) => n + (/[぀-ヿ一-鿿가-힯]/.test(g) ? 1 : 0.62), 0);
  return Math.max(11, Math.min(21, Math.floor(140 / Math.max(units, 1))));
}

function cardSvg(word, art, revealed) {
  const key = `${code}_${word.id}_${revealed ? 'rev' : 'norm'}`;
  const letter = pack.letters.find((l) => l.id === word.letter);
  const image =
    art?.kind === 'jpg'
      ? `<clipPath id="imgClip_${key}"><rect x="23" y="24" width="154" height="148" rx="14"/></clipPath>
    <image href="${art.href}" x="23" y="24" width="154" height="148" preserveAspectRatio="xMidYMid slice" clip-path="url(#imgClip_${key})"/>`
      : art?.kind === 'svg'
        ? `<g transform="translate(38, 36) scale(1.24)">${art.inner}</g>`
        : `<text x="100" y="112" font-family="${fontStack}" font-size="56" fill="#c8b49e" text-anchor="middle">?</text>`;
  const seal = revealed
    ? `<g>
      <line x1="37" y1="20" x2="37" y2="24" stroke="#e5a823" stroke-width="2" stroke-linecap="round"/>
      <line x1="37" y1="52" x2="37" y2="56" stroke="#e5a823" stroke-width="2" stroke-linecap="round"/>
      <line x1="19" y1="38" x2="23" y2="38" stroke="#e5a823" stroke-width="2" stroke-linecap="round"/>
      <line x1="51" y1="38" x2="55" y2="38" stroke="#e5a823" stroke-width="2" stroke-linecap="round"/>
      <circle cx="37" cy="38" r="14" fill="#f7c948" stroke="#d49b20" stroke-width="2"/>
      <text x="37" y="44.5" font-family="${fontStack}" font-weight="${fontWeight}" font-size="17" fill="#332d29" text-anchor="middle">${escapeHtml(letter.char)}</text>
    </g>`
    : `<g>
      <circle cx="37" cy="38" r="12" fill="#f4ece1" stroke="#c8b49e" stroke-width="1.5"/>
      <path d="M37,29 L38.6,35.4 L45,37 L38.6,38.6 L37,45 L35.4,38.6 L29,37 L35.4,35.4 Z" fill="#d49b20" opacity="0.85"/>
      <circle cx="37" cy="37" r="1.8" fill="#fffdfa"/>
    </g>`;
  const banner = revealed
    ? `<g>
      <rect x="24" y="176" width="152" height="38" rx="12" fill="#fffdfa" stroke="#e5a823" stroke-width="2.5" filter="url(#cardShadow)"/>
      <text x="100" y="202.5" font-family="${fontStack}" font-weight="${fontWeight}" font-size="${wordFontSize(word.text)}" fill="#332d29" text-anchor="middle" direction="${rtl ? 'rtl' : 'ltr'}" unicode-bidi="plaintext">${wordMarkup(word.text)}</text>
    </g>`
    : `<g>
      <rect x="26" y="178" width="148" height="34" rx="10" fill="#f3ece1" stroke="#d8c5b0" stroke-width="1.5"/>
      <path d="M68,195 Q74,189 80,195 Q86,201 92,195 M96,195 Q102,189 108,195 Q114,201 120,195 M124,195 Q130,189 136,195" stroke="#ba9e82" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <circle cx="56" cy="195" r="2.5" fill="#e26a57" opacity="0.75"/>
      <circle cx="144" cy="195" r="2.5" fill="#e26a57" opacity="0.75"/>
    </g>`;
  return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" lang="${code}">
  <defs>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="125%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#36291e" flood-opacity="0.16"/>
    </filter>
    <linearGradient id="cardBg_${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fffefc"/><stop offset="100%" stop-color="#f7f0e4"/></linearGradient>
    <linearGradient id="viewportBg_${key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#eff5f6"/><stop offset="100%" stop-color="#faf8f2"/></linearGradient>
  </defs>
  <rect x="8" y="6" width="184" height="228" rx="22" fill="url(#cardBg_${key})" stroke="#c7b29a" stroke-width="3" filter="url(#cardShadow)"/>
  <rect x="15" y="13" width="170" height="214" rx="16" fill="none" stroke="#ba9e82" stroke-width="1.6" stroke-dasharray="5, 3" opacity="0.6"/>
  <rect x="19" y="17" width="162" height="206" rx="13" fill="none" stroke="#ded2c0" stroke-width="1"/>
  <circle cx="24" cy="22" r="1.5" fill="#ba9e82" opacity="0.5"/><circle cx="176" cy="22" r="1.5" fill="#ba9e82" opacity="0.5"/>
  <circle cx="24" cy="218" r="1.5" fill="#ba9e82" opacity="0.5"/><circle cx="176" cy="218" r="1.5" fill="#ba9e82" opacity="0.5"/>
  <rect x="23" y="24" width="154" height="148" rx="14" fill="url(#viewportBg_${key})" stroke="#ded0be" stroke-width="1.5"/>
  ${image}
  ${seal}
  ${banner}
</svg>
`;
}

const cards = [];
const missingArt = [];
for (const word of pack.words) {
  const art = artFor(word);
  if (!art) {
    missingArt.push(word);
    continue;
  }
  writeFileSync(join(OUT, `${word.id}-card.svg`), cardSvg(word, art, false));
  writeFileSync(join(OUT, `${word.id}-revealed.svg`), cardSvg(word, art, true));
  cards.push({
    id: word.id,
    letter: word.letter,
    word: word.text,
    iconPath: art.kind === 'jpg' ? art.href : `/art/flashcards/${word.art}.svg`,
    cardPath: `/art/flashcards/${code}/${word.id}-card.svg`,
    revealedCardPath: `/art/flashcards/${code}/${word.id}-revealed.svg`,
  });
}

ensureDir(generatedDir(code));
writeFileSync(
  join(generatedDir(code), 'cards.generated.ts'),
  `// GENERATED by app/scripts/lang/build-flashcards.mjs from app/languages/${code}/pack.json — do not edit.
// Same shape as data/flashcards.ts's FlashCardDef; \`letter\` is a letter id.

export const CARDS = ${JSON.stringify(cards, null, 2)} as const;
`,
);
console.log(`Wrote ${cards.length * 2} card SVGs to ${OUT} and cards.generated.ts.`);

if (missingArt.length) {
  console.log(`${missingArt.length} word(s) have no picture yet: ${missingArt.map((w) => w.art ?? w.id).join(', ')}`);
  if (flags['art-manifest']) {
    const entries = missingArt.map((w) => ({
      id: `word-${w.art ?? w.id}`,
      category: 'word-illustration',
      tier: 'flash',
      usesReference: 'buddy',
      aspectRatio: '1:1',
      word: (w.art ?? w.id).replace(/_/g, ' '),
      letter: '',
      prompt: `A single ${w.gloss.toLowerCase()}, simple flat icon illustration, centered.`,
      _for: `${code}:${w.id} (${w.text}) — review the prompt, merge into assets/manifest.json, generate, then save as app/public/art/flashcards/${w.art ?? w.id}.jpg (1024x1024) and set the word's "art"`,
    }));
    const path = join(ensureDir(OUT_DIR), `${code}-art-manifest.json`);
    writeJson(path, entries);
    console.log(`Art requests: ${path}`);
  }
}
