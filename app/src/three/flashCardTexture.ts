import * as THREE from 'three';
import { FLASHCARD_MAP } from '../data/flashcards';

const textureCache = new Map<string, THREE.Texture>();

// Card art is SVG with only a viewBox (no width/height). Handing that
// straight to WebGL (TextureLoader) is unreliable in Chrome: the image
// decodes at a tiny default size (125×150 here), and the GPU upload can
// come out blank — cards were invisible, and a revealed card a flat white
// panel, in the storm round's first test run. Rasterising the SVG into a
// 2D canvas at a real resolution first fixes both: every browser uploads
// canvases reliably, and the card is crisp instead of a blurry 125px.
// Some cards (13 of 72) also embed their art as an external .jpg
// (<image href="…jpg">) — which a browser silently refuses to load inside
// an SVG used as an image, leaving the card blank. Those references are
// inlined as data URLs before rasterising (see loadSvgImage).
const RASTER_WIDTH = 512;
const RASTER_HEIGHT = Math.round((RASTER_WIDTH * 240) / 200); // the cards' 200×240 viewBox

/**
 * Returns a cached, high-quality THREE.Texture for the given flashcard word id.
 * Supports both the unrevealed card (hiding name & badge) and revealed card (celebratory name & badge).
 */
export function getFlashCardTexture(wordId: string, revealed = false): THREE.Texture {
  const key = `${wordId}:${revealed ? 'rev' : 'norm'}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const def = FLASHCARD_MAP[wordId];
  let url = `/art/flashcards/${wordId}-${revealed ? 'revealed' : 'card'}.svg`;
  if (def) {
    url = revealed ? (def.revealedCardPath || `/art/flashcards/${wordId}-revealed.svg`) : def.cardPath;
  }

  const canvas = document.createElement('canvas');
  canvas.width = RASTER_WIDTH;
  canvas.height = RASTER_HEIGHT;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;

  void loadSvgImage(url).then((img) => {
    const g = canvas.getContext('2d');
    if (!g || !img) return;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    texture.needsUpdate = true;
  });

  textureCache.set(key, texture);
  return texture;
}

async function toDataUrl(href: string): Promise<string> {
  const blob = await (await fetch(href)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Loads an SVG as an <img>, with any external raster <image href> inlined first so it actually shows. */
async function loadSvgImage(url: string): Promise<HTMLImageElement | null> {
  try {
    let svg = await (await fetch(url)).text();
    const hrefs = [...new Set([...svg.matchAll(/href="([^"#][^"]*\.(?:jpe?g|png|webp))"/g)].map((m) => m[1]))];
    for (const href of hrefs) svg = svg.split(`"${href}"`).join(`"${await toDataUrl(href)}"`);
    const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Could not load ${url}`));
      img.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);
    return img;
  } catch {
    return null;
  }
}

/** Preloads flashcard textures (both normal and revealed) for smooth, stutter-free in-flight appearance. */
export function preloadFlashCardTextures(wordIds: string[]): void {
  for (const id of wordIds) {
    getFlashCardTexture(id, false);
    getFlashCardTexture(id, true);
  }
}

const imageUrlCache = new Map<string, Promise<string | null>>();

/**
 * A flash card's picture as an image URL for plain DOM use (e.g. the
 * Storm Vowels word board) — rasterised the same way as the 3D textures
 * above, so cards whose art is an embedded .jpg show there too.
 */
export function getFlashCardImageUrl(wordId: string): Promise<string | null> {
  const cached = imageUrlCache.get(wordId);
  if (cached) return cached;
  const url = FLASHCARD_MAP[wordId]?.cardPath ?? `/art/flashcards/${wordId}-card.svg`;
  const promise = loadSvgImage(url).then((img) => {
    if (!img) return null;
    const canvas = document.createElement('canvas');
    canvas.width = RASTER_WIDTH / 2;
    canvas.height = RASTER_HEIGHT / 2;
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  });
  imageUrlCache.set(wordId, promise);
  return promise;
}
