#!/usr/bin/env node
// Writes the native-speaker REVIEW SHEET for a language pack:
// app/scripts/lang/out/<code>-review.html
//
//   node app/scripts/lang/preview.mjs <code>
//
// One page a reviewer who reads the language (but not code) can check
// top to bottom: every letter in teaching order with its name, sound and
// second form in the real cloud font; every word with its picture, first
// sound and English gloss; every round's content; every spoken phrase;
// and a player for each generated audio clip. Anything that looks or
// sounds wrong goes in app/languages/<code>/NOTES.md's review table.

import { existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { APP, ensureDir, escapeHtml as h, googleFontsCssHref, loadPack, OUT_DIR, parseArgs } from './lib.mjs';

const { positional } = parseArgs();
const code = positional[0];
if (!code) {
  console.error('Usage: node app/scripts/lang/preview.mjs <code>');
  process.exit(2);
}
const pack = loadPack(code);
ensureDir(OUT_DIR);
const pub = (p) => relative(OUT_DIR, join(APP, 'public', p));
const dir = pack.script.direction;
const disp = pack.script.fonts.display;
const byId = Object.fromEntries(pack.letters.map((l) => [l.id, l]));
const audioBase = code === 'en' ? null : `audio/${code}`;
const clip = (sub, id) => {
  if (!audioBase) return '';
  const rel = `${audioBase}/${sub}/${id}.wav`;
  return existsSync(join(APP, 'public', rel)) ? `<audio controls preload="none" src="${pub(rel)}"></audio>` : '<span class="miss">no clip</span>';
};
const art = (a) => {
  if (!a) return '<div class="noart">no picture</div>';
  for (const ext of ['jpg', 'svg']) if (existsSync(join(APP, 'public/art/flashcards', `${a}.${ext}`))) return `<img src="${pub(`art/flashcards/${a}.${ext}`)}" alt="${h(a)}">`;
  return `<div class="noart">missing art "${h(a)}"</div>`;
};
const t = (s) => `<span class="script" dir="${dir}">${h(s.replace(/‍/g, '‍'))}</span>`;

// Chapters over the curriculum.
let cursor = 0;
const chapterBlocks = (pack.chapters ?? []).map((ch) => {
  const ids = pack.curriculum.slice(cursor, cursor + ch.size);
  cursor += ch.size;
  const rows = ids
    .map((id) => {
      const l = byId[id];
      return `<tr>
  <td class="big">${t(l.char)}</td><td class="big">${l.secondary ? t(l.secondary) : '—'}</td>
  <td>${t(l.name)} ${clip('letters', l.id)}</td>
  <td>${l.sound === null ? '<i>none</i>' : `${t(l.sound)} ${clip('sounds', l.id)}`}</td>
  <td>${h(l.ipa)}<br><small>${h(l.romanization)} · ${h(l.id)}</small></td>
  <td>${l.nameAliases.map((a) => t(a)).join(', ')}</td>
  <td><small>${h(l.note ?? '')}</small></td></tr>`;
    })
    .join('\n');
  return `<h3>${t(ch.name)} <small>(${ch.size} letters)</small></h3>
<table><tr><th>Letter</th><th>${h(pack.script.forms.secondaryLabel ?? 'Second form')}</th><th>Name</th><th>Sound</th><th>IPA</th><th>Speech aliases</th><th>Note</th></tr>${rows}</table>`;
});

const wordsByLetter = pack.curriculum
  .map((id) => {
    const ws = pack.words.filter((w) => w.letter === id);
    const cards = ws
      .map((w) => `<figure class="word">${art(w.art)}<figcaption>${t(w.text)} ${clip('words', w.id)}<br><small>${h(w.gloss)} · first sound "${h(w.initialSound)}"</small></figcaption></figure>`)
      .join('');
    return `<div class="letterwords"><div class="big">${t(byId[id].char)}</div><div class="words">${cards || '<span class="miss">no words</span>'}</div></div>`;
  })
  .join('\n');

const r = pack.rounds;
const blend = r.blend
  ? `<table><tr><th>Letters in order</th><th>Word</th><th>Gloss</th></tr>${r.blend.words.map((w) => `<tr><td>${w.letters.map((id) => t(byId[id]?.char ?? '?')).join(' + ')}</td><td>${t(w.text)} ${clip('words', w.id)}</td><td>${h(w.gloss)}</td></tr>`).join('')}</table>`
  : '<p><i>Off for this language.</i></p>';
const missing = r.missingPiece
  ? `<p>Choices: ${r.missingPiece.choices.map((c) => `${t(c.text)} <small>(${h(c.speak)})</small>`).join(' · ')}</p>
<table><tr><th>Shown</th><th>Answer</th><th>Word</th><th>Gloss</th></tr>${r.missingPiece.words.map((w) => `<tr><td>${t(w.parts.map((p, i) => (i === w.gap ? '_' : p)).join(' '))}</td><td>${t(r.missingPiece.choices.find((c) => c.id === w.answer)?.text ?? '?')}</td><td>${t(w.text)}</td><td>${h(w.gloss)}</td></tr>`).join('')}</table>`
  : '<p><i>Off for this language.</i></p>';
const HEX = { red: '#e8453c', orange: '#f39a2b', yellow: '#f7d23e', green: '#4cb963', blue: '#3d8fe0', purple: '#9b5fd0' };
const rainbow = r.rainbow.map((c) => `<span class="swatch" style="background:${HEX[c.id]}"></span>${t(c.text)} <small>${c.letter ? `(${h(byId[c.letter]?.char ?? '?')})` : ''}</small>`).join(' &nbsp; ');
const lookAlikes = pack.lookAlikes.map(([a, b]) => { const f = (l) => (pack.lookAlikeForm === 'secondary' ? l.secondary : l.char); return `<span class="pair">${t(f(byId[a]) ?? '?')} ${t(f(byId[b]) ?? '?')}</span>`; }).join(' ');

const en = code === 'en' ? pack : (await import('./lib.mjs')).loadPack('en');
const phraseRows = Object.keys(en.phrases)
  .map((k) => {
    const show = (v) => (typeof v === 'string' ? v : Object.entries(v).map(([c, s]) => `${c}: ${s}`).join('\n'));
    return `<tr><td><code>${h(k)}</code></td><td>${h(show(en.phrases[k]))}</td><td style="white-space:pre-line">${t(show(pack.phrases[k] ?? '—'))}</td><td>${typeof pack.phrases[k] === 'string' && !/\{/.test(pack.phrases[k]) ? clip('phrases', k) : ''}</td></tr>`;
  })
  .join('');

const html = `<!doctype html>
<html lang="${code}"><head><meta charset="utf-8"><title>${h(pack.name)} review sheet</title>
<link rel="stylesheet" href="${googleFontsCssHref([disp, pack.script.fonts.ui])}">
<style>
  body { font: 14px/1.45 system-ui, sans-serif; margin: 20px auto; max-width: 1100px; padding: 0 16px; color: #332d29; background: #fbf8f2; }
  h1 { margin-bottom: 0; } h2 { margin-top: 32px; border-bottom: 2px solid #e3d8c8; }
  .script { font-family: '${disp.family}', system-ui, sans-serif; font-weight: ${disp.weight}; }
  table { border-collapse: collapse; width: 100%; background: #fff; margin: 8px 0; }
  th, td { border: 1px solid #e3d8c8; padding: 5px 8px; text-align: start; vertical-align: middle; }
  th { background: #f3ece1; font-size: 12px; }
  .big { font-size: 34px; text-align: center; }
  .big .script { font-size: 44px; }
  .letterwords { display: flex; gap: 12px; align-items: center; border-bottom: 1px dashed #e3d8c8; padding: 8px 0; }
  .letterwords > .big { width: 70px; flex: none; }
  .words { display: flex; flex-wrap: wrap; gap: 10px; }
  .word { margin: 0; width: 150px; background: #fff; border: 1px solid #e3d8c8; border-radius: 10px; padding: 6px; }
  .word img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; }
  .word .script { font-size: 22px; }
  .noart { aspect-ratio: 1; display: grid; place-items: center; background: #fff1ee; color: #b34a3a; border-radius: 6px; font-size: 12px; }
  .miss { color: #b34a3a; font-size: 12px; }
  .swatch { display: inline-block; width: 14px; height: 14px; border-radius: 50%; vertical-align: middle; margin-inline-end: 4px; }
  .pair { display: inline-block; font-size: 30px; background: #fff; border: 1px solid #e3d8c8; border-radius: 8px; padding: 2px 10px; margin: 3px; }
  audio { height: 26px; vertical-align: middle; max-width: 170px; }
  .meta td:first-child { width: 220px; font-weight: 600; }
</style></head><body>
<h1>${h(pack.name)} <span class="script">${h(pack.nativeName)}</span></h1>
<p>Review sheet — status <b>${h(pack.status)}</b>. Check every letter, word, picture, round and recording. Note anything wrong in <code>app/languages/${code}/NOTES.md</code>.</p>
<table class="meta">
<tr><td>Script / direction</td><td>${h(pack.script.id)} / ${h(dir)}</td></tr>
<tr><td>Second form</td><td>${h(pack.script.forms.model)}: ${h(pack.script.forms.primaryLabel)} → ${h(pack.script.forms.secondaryLabel ?? '—')}, from mastery box ${pack.script.forms.introduceSecondaryFromBox}</td></tr>
<tr><td>Fonts</td><td>display ${h(disp.family)} ${disp.weight}, UI ${h(pack.script.fonts.ui.family)} ${pack.script.fonts.ui.weight}</td></tr>
<tr><td>Writing page</td><td>${h(pack.script.writingGuide)}</td></tr>
<tr><td>Speech</td><td>recognition ${h(pack.locales.speechRecognition)}, synthesis ${h(pack.locales.speechSynthesis)}</td></tr>
<tr><td>Features</td><td>${Object.entries(pack.features).map(([k, v]) => `${h(k)}: ${v ? 'on' : 'off'}`).join(' · ')}</td></tr>
</table>

<h2>1. Letters, in teaching order</h2>
${chapterBlocks.join('\n')}

<h2>2. Words (flash cards)</h2>
<p>Every word must start with its letter's SOUND, be known to a 4–6 year old, and be clearly drawable. The picture must show exactly that word.</p>
${wordsByLetter}

<h2>3. Rounds</h2>
<h3>Blend (catch the letters in order)</h3>${blend}
<h3>Missing piece</h3>${missing}
<h3>Rainbow colours</h3><p>${rainbow}</p>
<h3>Look-alike pairs (${h(pack.lookAlikeForm)} form)</h3><p>${lookAlikes || '<i>none</i>'}</p>
<h3>Sounds too close to contrast</h3><p>${pack.confusableSounds.map(([a, b]) => `${h(a)} / ${h(b)}`).join(' · ') || '<i>none</i>'}</p>

<h2>4. Spoken phrases</h2>
<table><tr><th>Key</th><th>English</th><th>${h(pack.name)}</th><th>Clip</th></tr>${phraseRows}</table>
<script>document.fonts.ready.then(() => { document.body.dataset.ready = '1'; });</script>
</body></html>
`;
const path = join(OUT_DIR, `${code}-review.html`);
writeFileSync(path, html);
console.log(`Review sheet: ${path}`);
