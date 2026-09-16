import type { CloudPoint } from './cloudLetter';
import { drawIconSilhouette } from './nounShapes';

/**
 * Same rasterize-and-sample technique as cloudLetter.ts's
 * sampleLetterPoints, generalized to any silhouette drawn by
 * nounShapes.ts instead of a text glyph. Used for the "day" cloud/smoke
 * rendering, which wants a dense point cloud like a letter puff-cloud.
 */
export function sampleIconPoints(id: string, sizePx = 200, step = 4): CloudPoint[] {
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.clearRect(0, 0, sizePx, sizePx);
  ctx.fillStyle = '#ffffff';
  drawIconSilhouette(id, ctx, sizePx);

  const { data } = ctx.getImageData(0, 0, sizePx, sizePx);
  const points: CloudPoint[] = [];
  for (let y = 0; y < sizePx; y += step) {
    for (let x = 0; x < sizePx; x += step) {
      const alpha = data[(x + y * sizePx) * 4 + 3];
      if (alpha > 80) points.push({ x: x - sizePx / 2, y: -(y - sizePx / 2) });
    }
  }
  return points;
}

/**
 * Only the SILHOUETTE'S OUTLINE — inside pixels with at least one
 * outside/transparent neighbor at the same grid step — not every inside
 * pixel. A first version of buildConstellation sampled the filled
 * interior (like sampleIconPoints above), and connecting a grid of
 * interior points with a minimum spanning tree draws exactly what
 * you'd expect from that: a comb/lattice pattern, since that's what an
 * MST over a uniformly-filled grid looks like regardless of point
 * count — checked directly by rendering it, not assumed. Tracing the
 * outline instead is what makes the result actually read as the
 * silhouette (confirmed the same way): a cat's round head and pointy
 * ears, not a rectangle of dots.
 */
function sampleOutlinePoints(id: string, sizePx: number, step: number): CloudPoint[] {
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.fillStyle = '#ffffff';
  drawIconSilhouette(id, ctx, sizePx);
  const { data } = ctx.getImageData(0, 0, sizePx, sizePx);

  const alphaAt = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= sizePx || y >= sizePx) return 0;
    return data[(x + y * sizePx) * 4 + 3];
  };

  const points: CloudPoint[] = [];
  for (let y = 0; y < sizePx; y += step) {
    for (let x = 0; x < sizePx; x += step) {
      if (alphaAt(x, y) <= 80) continue;
      const isBoundary =
        alphaAt(x - step, y) <= 80 || alphaAt(x + step, y) <= 80 || alphaAt(x, y - step) <= 80 || alphaAt(x, y + step) <= 80;
      if (isBoundary) points.push({ x: x - sizePx / 2, y: -(y - sizePx / 2) });
    }
  }
  return points;
}

export interface ConstellationEdge {
  a: number;
  b: number;
}

export interface Constellation {
  points: CloudPoint[];
  edges: ConstellationEdge[];
}

/**
 * "Night" mode wants a sparse handful of star joints connected by lines,
 * like the zodiac-constellation reference image — not a dense puff
 * cloud. Sampling the silhouette's outline (see sampleOutlinePoints)
 * gives a natural, shape-preserving set of joints (no per-word hand
 * authoring), and a Euclidean minimum spanning tree over them is a
 * general way to connect every star into one figure without manual
 * topology per word: it's exactly the "connect the dots with the
 * shortest total thread" problem, which is what a hand-drawn
 * constellation figure looks like.
 */
export function buildConstellation(id: string, sizePx = 260, step = 12): Constellation {
  const points = sampleOutlinePoints(id, sizePx, step);
  const n = points.length;
  const edges: ConstellationEdge[] = [];
  if (n < 2) return { points, edges };

  const inTree = new Array<boolean>(n).fill(false);
  const dist = new Array<number>(n).fill(Infinity);
  const parent = new Array<number>(n).fill(-1);
  dist[0] = 0;

  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!inTree[i] && dist[i] < best) {
        best = dist[i];
        u = i;
      }
    }
    if (u === -1) break;
    inTree[u] = true;
    if (parent[u] !== -1) edges.push({ a: parent[u], b: u });

    for (let v = 0; v < n; v++) {
      if (inTree[v]) continue;
      const dx = points[u].x - points[v].x;
      const dy = points[u].y - points[v].y;
      const d = dx * dx + dy * dy;
      if (d < dist[v]) {
        dist[v] = d;
        parent[v] = u;
      }
    }
  }
  return { points, edges };
}
