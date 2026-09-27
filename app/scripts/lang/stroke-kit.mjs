// The stroke-authoring kit handed to app/languages/<code>/strokes.mjs.
//
// A strokes.mjs default-exports `(kit, { loadTs }) => forms` where forms
// maps each character (primary AND secondary forms, exactly as they
// appear in pack.json) to an array of SVG path strings: one string per
// pen stroke, in teaching order, each drawn in its writing direction
// (the path's first point is where the pen lands). No pen lifts inside a
// string. Same contract as app/src/data/letterStrokes.ts for English.
//
// Geometry is computed, not hand-typed, so a letter that looks wrong is
// retuned by changing a number and rerunning — the lesson from
// app/scripts/generate-letter-strokes.mjs (docs/07-architecture.md#letter-writing-animation).
//
// NEVER copy stroke data from another project (KanjiVG, Unicode stroke
// databases, font outlines): most are CC BY-SA, whose share-alike terms
// conflict with this project's proprietary license. Author every stroke
// here and check it in the preview (build-strokes.mjs).

/**
 * Metrics per writing guide. All guides use a 100-wide viewBox; y grows
 * downward. The lines here are also where WritingPractice draws its guide
 * lines, so strokes must respect them.
 */
export const GUIDE_METRICS = {
  // Latin handwriting lines — identical to the English data.
  'four-line': { viewBox: [0, 0, 100, 120], lines: { top: 15, mid: 52, base: 100, desc: 116 } },
  // Hebrew print: letters fill the band top..base; ל rises to `asc`;
  // ק ך ן ף ץ drop to `desc`.
  'two-line': { viewBox: [0, 0, 100, 120], lines: { asc: 12, top: 40, base: 92, desc: 116 } },
  // Arabic: everything hangs off one strong baseline. `tooth` is the
  // height of a short letter body (ب's teeth, the top of ه); alif and lam
  // reach `asc`; descending tails reach `desc`.
  baseline: { viewBox: [0, 0, 100, 120], lines: { asc: 10, tooth: 52, base: 78, desc: 112 } },
  // Japanese/Korean square cell with a dashed centre cross. Characters sit
  // inside the inner square (inset 10), centred on (50, 50).
  grid: { viewBox: [0, 0, 100, 100], lines: { top: 10, mid: 50, base: 90, left: 10, right: 90 } },
};

export function createStrokeKit(guide) {
  const metrics = GUIDE_METRICS[guide];
  if (!metrics) throw new Error(`Unknown writing guide "${guide}"`);

  const round = (n) => Math.round(n * 10) / 10;
  const rad = (d) => (d * Math.PI) / 180;
  const pstr = (p) => `${round(p[0])},${round(p[1])}`;

  /** Point on an ellipse at a CLOCK angle: 0 = top, 90 = right, 180 = bottom, 270 = left, increasing clockwise. */
  const ept = (cx, cy, rx, ry, deg) => [cx + rx * Math.sin(rad(deg)), cy - ry * Math.cos(rad(deg))];

  /** Straight stroke through two or more points (corners allowed: "L" shape, zigzags). */
  const line = (...pts) => `M${pstr(pts[0])} ${pts.slice(1).map((p) => `L${pstr(p)}`).join(' ')}`;

  /**
   * An elliptical arc from clock angle `from` to `to`, drawn clockwise when
   * to > from and anticlockwise when to < from (e.g. 90 → -180 sweeps
   * anticlockwise three quarters). Spans over 360° are clamped.
   * Emitted as short SVG arc pieces so the direction is never ambiguous
   * (a single A command with nearby endpoints can silently take the
   * short way or the mirrored circle).
   */
  const arcPoints = (cx, cy, rx, ry, from, to) => {
    const span = Math.max(-359.9, Math.min(359.9, to - from));
    const pieces = Math.max(1, Math.ceil(Math.abs(span) / 90));
    const out = [];
    for (let i = 1; i <= pieces; i++) out.push(ept(cx, cy, rx, ry, from + (span * i) / pieces));
    return { start: ept(cx, cy, rx, ry, from), ends: out, sweep: span > 0 ? 1 : 0 };
  };
  const arc = (cx, cy, rx, ry, from, to) => {
    const { start, ends, sweep } = arcPoints(cx, cy, rx, ry, from, to);
    return `M${pstr(start)} ${ends.map((p) => `A${round(rx)},${round(ry)} 0 0,${sweep} ${pstr(p)}`).join(' ')}`;
  };

  /** A full ring starting at clock angle `start` (default top), clockwise unless ccw. */
  const ring = (cx, cy, rx, ry, start = 0, ccw = false) => arc(cx, cy, rx, ry, start, start + (ccw ? -359.9 : 359.9));

  /**
   * Multi-segment single stroke: pen(start).line(p).quad(c, p).cubic(c1, c2, p)
   * .arc(cx, cy, rx, ry, from, to).done(). `.arc` continues from wherever
   * the pen is (it should already be at the arc's `from` point).
   */
  const pen = (start) => {
    const parts = [`M${pstr(start)}`];
    const api = {
      line: (...pts) => (parts.push(...pts.map((p) => `L${pstr(p)}`)), api),
      quad: (c, p) => (parts.push(`Q${pstr(c)} ${pstr(p)}`), api),
      cubic: (c1, c2, p) => (parts.push(`C${pstr(c1)} ${pstr(c2)} ${pstr(p)}`), api),
      arc: (cx, cy, rx, ry, from, to) => {
        const { ends, sweep } = arcPoints(cx, cy, rx, ry, from, to);
        parts.push(...ends.map((p) => `A${round(rx)},${round(ry)} 0 0,${sweep} ${pstr(p)}`));
        return api;
      },
      done: () => parts.join(' '),
    };
    return api;
  };

  /** A dot (Arabic i'jam dots, the dot of i/j, dakuten ticks): a tiny stroke the tracer treats as a tap. */
  const dot = (x, y) => `M${pstr([x, y])} L${pstr([x + 0.6, y + 0.6])}`;

  return { guide, metrics, lines: metrics.lines, ept, line, arc, ring, pen, dot, round };
}
