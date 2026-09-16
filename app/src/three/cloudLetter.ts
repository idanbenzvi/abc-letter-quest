import * as THREE from 'three';

/**
 * Letter-shaped cloud puffs — technique adapted (MIT) from Codrops'
 * "Typing Effects with Three.js" clouds demo:
 * https://github.com/uuuulala/WebGL-typing-tutorial (js/01_clouds.js).
 * Core idea, unchanged: render the glyph to an offscreen 2D canvas,
 * read back which pixels are "inside" it, and place one soft billboard
 * puff sprite per sampled pixel via a single InstancedMesh. Not a
 * volumetric/raymarched cloud — a sprite trick — which is exactly why
 * it stays cheap enough for a tablet. See docs/07-architecture.md#flight-game.
 */

export interface CloudPoint {
  x: number;
  y: number;
}

/** Samples the "inside" pixels of one glyph, centered at (0,0), y-up. */
export function sampleLetterPoints(letter: string, fontPx = 240, step = 4): CloudPoint[] {
  const size = Math.round(fontPx * 1.3);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${fontPx}px Nunito, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, size / 2, size / 2 + fontPx * 0.05);

  const { data } = ctx.getImageData(0, 0, size, size);
  const points: CloudPoint[] = [];
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const alpha = data[(x + y * size) * 4 + 3];
      if (alpha > 80) {
        points.push({ x: x - size / 2, y: -(y - size / 2) });
      }
    }
  }
  return points;
}

/** A small soft radial-gradient sprite, generated at runtime (no bundled image asset). */
export function createPuffTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.65)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export interface PuffSeed {
  maxScale: number;
  phase: number;
  speed: number;
  rotation: number;
  depthJitter: number;
  /** Outward+upward drift direction for the "typed it" bubble-burst — derived from each puff's own offset from the glyph's center, so the burst reads as the letter exploding outward from itself, not a generic particle spray. */
  burstDirX: number;
  burstDirY: number;
  burstSpin: number;
  /** Small per-puff stagger so the burst cascades instead of popping as one flat sheet. */
  burstDelay: number;
}

export function makePuffSeeds(points: CloudPoint[]): PuffSeed[] {
  return points.map((p) => {
    const len = Math.hypot(p.x, p.y) || 1;
    return {
      maxScale: 0.55 + 1.3 * Math.pow(Math.random(), 6),
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + 0.4 * Math.random(),
      rotation: Math.random() * Math.PI,
      depthJitter: (Math.random() - 0.5) * 0.6,
      burstDirX: p.x / len + (Math.random() - 0.5) * 0.7,
      burstDirY: p.y / len + (Math.random() - 0.5) * 0.7 + 0.5,
      burstSpin: (Math.random() - 0.5) * 6,
      burstDelay: Math.random() * 0.15,
    };
  });
}

/** A translucent, rim-lit sprite for the "typed it" bubble-burst — same
 * billboard-per-instance trick as createPuffTexture, but shaped like a
 * soap bubble (hollow center, bright glint) instead of a soft cloud puff. */
export function createBubbleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2;
    const body = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
    body.addColorStop(0, 'rgba(210,245,255,0.05)');
    body.addColorStop(0.7, 'rgba(215,248,255,0.4)');
    body.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    const glint = ctx.createRadialGradient(cx - r * 0.32, cy - r * 0.34, 0, cx - r * 0.32, cy - r * 0.34, r * 0.28);
    glint.addColorStop(0, 'rgba(255,255,255,0.95)');
    glint.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glint;
    ctx.beginPath();
    ctx.arc(cx - r * 0.32, cy - r * 0.34, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
