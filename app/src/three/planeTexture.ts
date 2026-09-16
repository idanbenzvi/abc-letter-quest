import * as THREE from 'three';

/**
 * A small cartoon banner-plane, drawn once to a canvas and used as a
 * billboard sprite — same technique as cloudLetter.ts's createPuffTexture
 * and NounSkyIcon's createStarTexture, just a single crisp icon instead
 * of a puff/star sampled many times over. A plane reads as a solid,
 * distinct little vehicle rather than a cloud, which is the point: it
 * needs to look unmistakably different from the letter-clouds and
 * picture-choice icons already in this sky. Nose points right (+x) to
 * match PlaneChoice.tsx's left-to-right flight direction, with the
 * letter banner trailing behind on a tow line.
 */
export function createPlaneTexture(letter: string, color: string): THREE.CanvasTexture {
  const w = 320;
  const h = 150;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.clearRect(0, 0, w, h);

  // Tow line, drawn first so the banner/plane paint over its ends.
  ctx.strokeStyle = 'rgba(60,50,40,0.55)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(172, 75);
  ctx.lineTo(204, 75);
  ctx.stroke();

  // Banner: rounded rect, colored border, big bold letter.
  const bx = 8;
  const by = 38;
  const bw = 168;
  const bh = 74;
  const r = 16;
  ctx.fillStyle = '#fffaf0';
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
  ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
  ctx.arcTo(bx, by + bh, bx, by, r);
  ctx.arcTo(bx, by, bx + bw, by, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // A little pennant notch on the banner's trailing (left) edge.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(bx, by + bh * 0.5 - 14);
  ctx.lineTo(bx - 16, by + bh * 0.5);
  ctx.lineTo(bx, by + bh * 0.5 + 14);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#3a2f24';
  ctx.font = "900 68px 'Nunito', Arial, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, bx + bw / 2, by + bh / 2 + 4);

  // Plane body: fuselage, tail fin, two wings, nose propeller — nose at
  // the canvas's right edge, pointing further right (direction of travel).
  const noseX = 306;
  const bodyY = 75;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(noseX, bodyY);
  ctx.lineTo(228, bodyY - 13);
  ctx.lineTo(206, bodyY - 8);
  ctx.lineTo(206, bodyY + 8);
  ctx.lineTo(228, bodyY + 13);
  ctx.closePath();
  ctx.fill();
  // Tail fin.
  ctx.beginPath();
  ctx.moveTo(214, bodyY - 6);
  ctx.lineTo(200, bodyY - 26);
  ctx.lineTo(224, bodyY - 8);
  ctx.closePath();
  ctx.fill();
  // Wings (a simple top-down X hinted at with two triangles), lighter tint.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(258, bodyY - 4);
  ctx.lineTo(250, bodyY - 34);
  ctx.lineTo(268, bodyY - 6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(258, bodyY + 4);
  ctx.lineTo(250, bodyY + 34);
  ctx.lineTo(268, bodyY + 6);
  ctx.closePath();
  ctx.fill();
  // Propeller disc — a soft translucent circle at the nose reads as a
  // spinning blur without needing per-frame redraws.
  ctx.fillStyle = 'rgba(80,70,60,0.35)';
  ctx.beginPath();
  ctx.ellipse(noseX + 4, bodyY, 10, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cockpit dot.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(258, bodyY - 1, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
