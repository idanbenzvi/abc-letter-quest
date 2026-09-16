#!/usr/bin/env node
// Generates app/src/data/letterStrokes.ts — SVG stroke-order path data
// for the "watch it get written" animation (docs/04-screens-spec.md).
// Geometry is computed (clock-angle trig for every curve) rather than
// hand-typed, specifically so it can be regenerated/retuned instead of
// hand-edited. Run: node scripts/generate-letter-strokes.mjs
//
// Coordinate system: viewBox "0 0 100 120", baseline y=100.
//   Cap height / ascenders: top y=15.  x-height top: y=52.  Descenders: bottom y=116.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '../src/data/letterStrokes.ts');

const round = (n) => Math.round(n * 10) / 10;
const norm = (d) => ((d % 360) + 360) % 360;
const rad = (d) => (d * Math.PI) / 180;

// Point on an ellipse centered (cx,cy), at "clock angle" deg: 0=top,
// 90=right, 180=bottom, 270=left, increasing clockwise.
function ept(cx, cy, rx, ry, deg) {
  const r = rad(deg);
  return [round(cx + rx * Math.sin(r)), round(cy - ry * Math.cos(r))];
}

function pstr(p) {
  return `${p[0]},${p[1]}`;
}

// One straight-line (possibly multi-point, i.e. corner) stroke.
function poly(...pts) {
  return `M${pstr(pts[0])} L${pts.slice(1).map(pstr).join(' L')}`;
}

// A full ring (circle/oval), starting at the top, drawn clockwise.
function ring(cx, cy, rx, ry) {
  const top = ept(cx, cy, rx, ry, 0);
  const bottom = ept(cx, cy, rx, ry, 180);
  return `M${pstr(top)} A${rx},${ry} 0 1,1 ${pstr(bottom)} A${rx},${ry} 0 1,1 ${pstr(top)}`;
}

// An open ring with a gap centered on gapCenterDeg spanning gapSpanDeg,
// drawn the long way around (counter-clockwise from the gap's start).
function openRing(cx, cy, rx, ry, gapCenterDeg, gapSpanDeg) {
  // Starts just before the gap (going backwards/counter-clockwise),
  // sweeps the LONG way around through the far side, ends just after
  // the gap on the other edge. sweep=0 (counter-clockwise/decreasing
  // angle) from `start`; the two points are close together (span =
  // gapSpanDeg) so largeArc must be forced to 1 or the renderer can
  // pick the short way (the gap itself) or even the mirrored small
  // circle through those two points — both wrong.
  const start = norm(gapCenterDeg - gapSpanDeg / 2);
  const end = norm(gapCenterDeg + gapSpanDeg / 2);
  const s = ept(cx, cy, rx, ry, start);
  const e = ept(cx, cy, rx, ry, end);
  return `M${pstr(s)} A${rx},${ry} 0 1,0 ${pstr(e)}`;
}

// -- shared coordinates -----------------------------------------------
const CAP_TOP = 15;
const BASE = 100;
const X_TOP = 52;
const DESC = 116;
const MID_CAP = (CAP_TOP + BASE) / 2; // 57.5
const MID_X = (X_TOP + BASE) / 2; // 76

const U = { L: 26, R: 74, MID: 50 }; // upper normal width
const UW = { L: 18, R: 82, MID: 50 }; // upper wide (M, W)
const Lx = { L: 30, R: 70, MID: 50 }; // lower x-height normal width
const Lw = { L: 20, R: 80, MID: 50 }; // lower wide (m, w)

const upperO = { cx: U.MID, cy: MID_CAP, rx: 24, ry: 42.5 };
const lowerBowl = { cx: Lx.MID, cy: MID_X, rx: 20, ry: 24 };

const UPPER = {
  A: [poly([U.L, BASE], [U.MID, CAP_TOP], [U.R, BASE]), poly([36, 65], [64, 65])],
  B: [poly([30, CAP_TOP], [30, BASE]), `M30,${CAP_TOP} Q68,${CAP_TOP} 68,36 Q68,57 30,57 Q70,57 70,78 Q70,${BASE} 30,${BASE}`],
  C: [openRing(upperO.cx, upperO.cy, upperO.rx, upperO.ry, 90, 70)],
  D: [poly([30, CAP_TOP], [30, BASE]), `M30,${CAP_TOP} Q76,${CAP_TOP} 76,${MID_CAP} Q76,${BASE} 30,${BASE}`],
  E: [poly([30, CAP_TOP], [30, BASE]), poly([30, CAP_TOP], [70, CAP_TOP]), poly([30, MID_CAP], [58, MID_CAP]), poly([30, BASE], [70, BASE])],
  F: [poly([30, CAP_TOP], [30, BASE]), poly([30, CAP_TOP], [70, CAP_TOP]), poly([30, MID_CAP], [58, MID_CAP])],
  G: [openRing(upperO.cx, upperO.cy, upperO.rx, upperO.ry, 90, 70), poly([70, 82], [70, 62], [50, 62])],
  H: [poly([30, CAP_TOP], [30, BASE]), poly([70, CAP_TOP], [70, BASE]), poly([30, MID_CAP], [70, MID_CAP])],
  I: [poly([U.MID, CAP_TOP], [U.MID, BASE])],
  J: [`M62,${CAP_TOP} L62,82 Q62,${BASE} 42,${BASE} Q30,${BASE} 30,86`],
  K: [poly([30, CAP_TOP], [30, BASE]), poly([68, CAP_TOP], [30, MID_CAP]), poly([30, MID_CAP], [68, BASE])],
  L: [poly([30, CAP_TOP], [30, BASE], [70, BASE])],
  M: [poly([24, BASE], [24, CAP_TOP], [U.MID, 55], [76, CAP_TOP], [76, BASE])],
  N: [poly([26, BASE], [26, CAP_TOP], [74, BASE], [74, CAP_TOP])],
  O: [ring(upperO.cx, upperO.cy, upperO.rx, upperO.ry)],
  P: [poly([30, CAP_TOP], [30, BASE]), `M30,${CAP_TOP} Q72,${CAP_TOP} 72,37 Q72,58 30,58`],
  Q: [ring(upperO.cx, upperO.cy, upperO.rx, upperO.ry), poly([60, 78], [80, 102])],
  R: [poly([30, CAP_TOP], [30, BASE]), `M30,${CAP_TOP} Q72,${CAP_TOP} 72,37 Q72,58 30,58`, poly([44, 58], [72, BASE])],
  S: [`M68,32 Q68,${CAP_TOP} 50,${CAP_TOP} Q30,${CAP_TOP} 30,33 Q30,48 50,${MID_CAP} Q70,67 70,83 Q70,${BASE} 50,${BASE} Q30,${BASE} 30,84`],
  T: [poly([24, CAP_TOP], [76, CAP_TOP]), poly([U.MID, CAP_TOP], [U.MID, BASE])],
  U: [`M30,${CAP_TOP} L30,76 Q30,${BASE} 50,${BASE} Q70,${BASE} 70,76 L70,${CAP_TOP}`],
  V: [poly([24, CAP_TOP], [50, BASE], [76, CAP_TOP])],
  W: [poly([18, CAP_TOP], [34, BASE], [50, 52], [66, BASE], [82, CAP_TOP])],
  X: [poly([28, CAP_TOP], [72, BASE]), poly([72, CAP_TOP], [28, BASE])],
  Y: [poly([26, CAP_TOP], [50, 55]), poly([74, CAP_TOP], [50, 55], [50, BASE])],
  Z: [poly([26, CAP_TOP], [74, CAP_TOP], [26, BASE], [74, BASE])],
};

const LOWER = {
  a: [ring(lowerBowl.cx, lowerBowl.cy, lowerBowl.rx, lowerBowl.ry), poly([70, X_TOP + 12], [70, BASE])],
  b: [poly([30, CAP_TOP], [30, BASE]), ring(52, MID_X, 18, 22)],
  c: [openRing(lowerBowl.cx, lowerBowl.cy, lowerBowl.rx, lowerBowl.ry, 90, 70)],
  d: [ring(lowerBowl.cx, lowerBowl.cy, lowerBowl.rx, lowerBowl.ry), poly([70, CAP_TOP], [70, BASE])],
  e: [`M30,${MID_X} L68,${MID_X} Q68,52 50,52 Q30,52 30,${MID_X + 3} Q30,${BASE} 50,${BASE} Q64,${BASE} 68,90`],
  f: [`M62,${CAP_TOP} Q40,${CAP_TOP} 40,34 L40,${BASE}`, poly([26, X_TOP], [58, X_TOP])],
  g: [ring(lowerBowl.cx, lowerBowl.cy, lowerBowl.rx, lowerBowl.ry), `M70,${MID_X} L70,104 Q70,116 50,116 Q38,116 36,106`],
  h: [poly([28, CAP_TOP], [28, BASE]), `M28,68 Q28,52 46,52 Q64,52 64,68 L64,${BASE}`],
  i: [poly([50, X_TOP], [50, BASE]), poly([50, 40], [50, 39])],
  j: [`M58,${X_TOP} L58,104 Q58,116 40,116`, poly([58, 40], [58, 39])],
  k: [poly([28, CAP_TOP], [28, BASE]), poly([62, 52], [30, 78]), poly([38, 74], [64, BASE])],
  l: [poly([50, CAP_TOP], [50, BASE])],
  m: [`M28,${BASE} L28,${X_TOP} Q28,52 44,52 Q54,52 54,68 L54,${BASE}`, `M54,68 Q54,52 70,52 Q80,52 80,68 L80,${BASE}`],
  n: [`M30,${BASE} L30,${X_TOP} Q30,52 46,52 Q64,52 64,68 L64,${BASE}`],
  o: [ring(lowerBowl.cx, lowerBowl.cy, lowerBowl.rx, lowerBowl.ry)],
  p: [`M30,${X_TOP} L30,116`, ring(50, MID_X, 18, 22)],
  q: [ring(lowerBowl.cx, lowerBowl.cy, lowerBowl.rx, lowerBowl.ry), `M70,${MID_X} L70,110 Q70,116 78,116`],
  r: [poly([30, X_TOP], [30, BASE]), `M30,60 Q30,52 46,52 Q56,52 60,${X_TOP}`],
  s: [`M64,60 Q64,52 50,52 Q34,52 34,63 Q34,74 50,${MID_X} Q66,78 66,89 Q66,${BASE} 50,${BASE} Q34,${BASE} 34,90`],
  t: [poly([46, 30], [46, BASE]), poly([28, X_TOP], [62, X_TOP])],
  u: [`M30,${X_TOP} L30,86 Q30,${BASE} 46,${BASE} Q62,${BASE} 62,86 L62,${X_TOP}`],
  v: [poly([28, X_TOP], [50, BASE], [72, X_TOP])],
  w: [poly([20, X_TOP], [33, BASE], [50, 68], [67, BASE], [80, X_TOP])],
  x: [poly([30, X_TOP], [70, BASE]), poly([70, X_TOP], [30, BASE])],
  y: [poly([28, X_TOP], [50, 82]), `M72,${X_TOP} L44,110 Q40,116 32,114`],
  z: [poly([30, X_TOP], [70, X_TOP], [30, BASE], [70, BASE])],
};

function toStrokesTs(map, label) {
  const entries = Object.entries(map)
    .map(([letter, strokes]) => `  ${JSON.stringify(letter)}: [\n${strokes.map((s) => `    ${JSON.stringify(s)},`).join('\n')}\n  ],`)
    .join('\n');
  return `const ${label}: Record<string, string[]> = {\n${entries}\n};`;
}

const banner = `// GENERATED FILE — do not hand-edit. Regenerate with:
//   node scripts/generate-letter-strokes.mjs
// Source: scripts/generate-letter-strokes.mjs. See
// docs/04-screens-spec.md#3-letter-learning and
// docs/07-architecture.md#letter-writing-animation for what this is for.
//
// Each letter maps to an array of stroke path strings — one array entry
// per pen stroke (no lifts within one string), in teaching stroke
// order. Coordinate system: viewBox "0 0 100 120", baseline y=100,
// cap/ascender top y=15, x-height top y=52, descender bottom y=116.

export interface LetterForm {
  strokes: string[];
}
`;

const body = [
  banner,
  toStrokesTs(UPPER, 'UPPER_STROKES'),
  toStrokesTs(LOWER, 'LOWER_STROKES'),
  `export const VIEW_BOX = '0 0 100 120';`,
  `
export function getLetterForm(letter: string, isUpper: boolean): LetterForm {
  // Normalize casing here rather than trusting the caller — callers
  // naturally pass the letter in whatever case their own context uses
  // (LetterLearning tracks the curriculum letter as uppercase always).
  const key = isUpper ? letter.toUpperCase() : letter.toLowerCase();
  const strokes = (isUpper ? UPPER_STROKES : LOWER_STROKES)[key];
  if (!strokes) throw new Error(\`No stroke data for \${isUpper ? 'uppercase' : 'lowercase'} "\${letter}"\`);
  return { strokes };
}
`,
].join('\n\n');

writeFileSync(OUT, body);
console.log(`wrote ${OUT}`);
