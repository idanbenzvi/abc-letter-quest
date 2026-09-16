/**
 * Canvas-2D silhouette drawers for the picture-choice bonus's candidate
 * words — one per id in WordIcons.tsx's ICONS map, redrawn as canvas
 * path/arc calls instead of SVG markup so cloudIcon.ts can rasterize and
 * sample them the same way cloudLetter.ts samples a text glyph. Shapes
 * mirror WordIcons.tsx's 100x100 viewBox coordinates (outer silhouette
 * only — small interior details like eyes are dropped; at cloud/star
 * scale they'd just be noise, not part of the recognizable shape).
 */

export type IconId = 'apple' | 'ball' | 'cat' | 'dog' | 'elephant' | 'fish';

type DrawFn = (ctx: CanvasRenderingContext2D, s: number) => void;

const DRAWERS: Record<IconId, DrawFn> = {
  apple(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(50 * s, 32 * s);
    ctx.bezierCurveTo(32 * s, 32 * s, 20 * s, 46 * s, 20 * s, 63 * s);
    ctx.bezierCurveTo(20 * s, 80 * s, 34 * s, 90 * s, 50 * s, 90 * s);
    ctx.bezierCurveTo(66 * s, 90 * s, 80 * s, 80 * s, 80 * s, 63 * s);
    ctx.bezierCurveTo(80 * s, 46 * s, 68 * s, 32 * s, 50 * s, 32 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(47 * s, 16 * s, 6 * s, 18 * s);
    ctx.save();
    ctx.translate(62 * s, 24 * s);
    ctx.rotate((-25 * Math.PI) / 180);
    ctx.beginPath();
    ctx.ellipse(0, 0, 11 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  ball(ctx, s) {
    ctx.beginPath();
    ctx.arc(50 * s, 50 * s, 34 * s, 0, Math.PI * 2);
    ctx.fill();
  },
  cat(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(24 * s, 38 * s);
    ctx.lineTo(16 * s, 14 * s);
    ctx.lineTo(38 * s, 30 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(76 * s, 38 * s);
    ctx.lineTo(84 * s, 14 * s);
    ctx.lineTo(62 * s, 30 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(50 * s, 58 * s, 30 * s, 26 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  dog(ctx, s) {
    ctx.beginPath();
    ctx.ellipse(50 * s, 60 * s, 34 * s, 28 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(20 * s, 40 * s);
    ctx.lineTo(10 * s, 15 * s);
    ctx.lineTo(34 * s, 32 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(80 * s, 40 * s);
    ctx.lineTo(90 * s, 15 * s);
    ctx.lineTo(66 * s, 32 * s);
    ctx.closePath();
    ctx.fill();
  },
  elephant(ctx, s) {
    ctx.beginPath();
    ctx.ellipse(58 * s, 62 * s, 28 * s, 20 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(34 * s, 46 * s, 19 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(16 * s, 43 * s, 12 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 7 * s;
    ctx.lineCap = 'round';
    ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath();
    ctx.moveTo(25 * s, 52 * s);
    ctx.quadraticCurveTo(14 * s, 70 * s, 22 * s, 80 * s);
    ctx.quadraticCurveTo(26 * s, 82 * s, 30 * s, 78 * s);
    ctx.stroke();
    ctx.fillRect(42 * s, 76 * s, 7 * s, 11 * s);
    ctx.fillRect(66 * s, 76 * s, 7 * s, 11 * s);
  },
  fish(ctx, s) {
    ctx.beginPath();
    ctx.ellipse(42 * s, 52 * s, 26 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(66 * s, 52 * s);
    ctx.lineTo(90 * s, 36 * s);
    ctx.lineTo(90 * s, 68 * s);
    ctx.closePath();
    ctx.fill();
  },
};

/** Generic fallback silhouette — a plain disc, mirroring GenericWordIcon's abstract-circle treatment for words without a hand-built shape. */
function drawGeneric(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.arc(50 * s, 50 * s, 34 * s, 0, Math.PI * 2);
  ctx.fill();
}

export function drawIconSilhouette(id: string, ctx: CanvasRenderingContext2D, sizePx: number) {
  const s = sizePx / 100;
  const fn = DRAWERS[id as IconId] ?? drawGeneric;
  fn(ctx, s);
}
