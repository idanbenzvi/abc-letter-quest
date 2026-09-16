import * as THREE from 'three';

// Runtime-generated sprite textures for the stroke guide + trace trail
// (StrokeGuide.tsx, LetterTracer.tsx). No image assets — same approach
// as cloudLetter.ts's puff/bubble textures. Each is cached per page.
//
// "Bloom" here is faked: a bright, opaque-ish CORE sprite (normal
// blending, so it stays visible over a white daytime cloud where an
// additive sprite would vanish into the white) plus a much larger, soft
// HALO sprite with additive blending (which is what actually reads as a
// glow against the sky). A real post-process bloom pass would also
// bloom the sun, the moon and every wave highlight of the raymarched
// ocean, and cost a full-screen pass on a tablet — not worth it for a
// few dozen sprites.

const cache = new Map<string, THREE.CanvasTexture>();

function make(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

/** Solid disc with a short soft edge — the opaque core of dots, the trail and the comet. */
export function createCoreTexture(): THREE.CanvasTexture {
  return make('core', 64, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.62, 'rgba(255,255,255,1)');
    g.addColorStop(0.82, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

/** Wide, very soft falloff — additive halo that fakes bloom. */
export function createHaloTexture(): THREE.CanvasTexture {
  return make('halo', 128, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.2, 'rgba(255,255,255,0.45)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

/** A clean rounded triangle pointing +x. (A notched chevron with a glow rim was tried first and read as a four-pointed star at cloud scale.) */
export function createArrowTexture(): THREE.CanvasTexture {
  return make('arrow', 96, (ctx, s) => {
    const cx = s / 2;
    const cy = s / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-20, -24);
    ctx.lineTo(28, 0);
    ctx.lineTo(-20, 24);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  });
}

/** Gold disc with a dark stroke-order number — "1", "2", "3"… */
export function createNumberTexture(n: number): THREE.CanvasTexture {
  return make(`num-${n}`, 96, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c, c, c - 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a4a10';
    ctx.font = "900 54px Nunito, 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), c, c + 3);
  });
}
