// Warm-up work that should finish while the child is still on the intro
// screen, so "Take Off!" cuts straight into a fully-formed scene instead
// of a bird popping in a beat late or the first letter cloud sampling a
// fallback font.

let fontsPromise: Promise<void> | null = null;

/**
 * Resolves once the two web fonts the game draws with are actually
 * usable — including the heavy Nunito weight cloudLetter.ts rasterizes
 * letter shapes from. Before this, an offscreen canvas can silently
 * fall back to Arial for the very first cloud, so the first letter of a
 * session would be drawn in a different typeface from every later one.
 * Never rejects and never takes longer than ~2.5s: a slow font CDN must
 * not hold the game hostage.
 */
export function preloadFonts(): Promise<void> {
  if (fontsPromise) return fontsPromise;
  fontsPromise = (async () => {
    if (typeof document === 'undefined' || !('fonts' in document)) return;
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2500));
    const loads = Promise.all([
      document.fonts.load('900 240px Nunito'),
      document.fonts.load('800 24px Nunito'),
      document.fonts.load("800 40px 'Baloo 2'"),
    ]).then(() => undefined);
    await Promise.race([loads, timeout]);
  })().catch(() => undefined);
  return fontsPromise;
}

/** True once the coarse-pointer (touch) heuristic says there's probably no physical keyboard — used to hide keyboard-only hints. */
export function isTouchOnlyDevice(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

/**
 * True on phones/tablets — reuses the same touch-only heuristic above (a
 * laptop with a touchscreen but also a mouse won't match, which is fine:
 * it's not the underpowered-GPU case this exists for). Used to drop
 * OceanSky's raymarch quality and the Canvas's render resolution, since
 * that fullscreen shader is squarely GPU-fragment-bound and mobile GPUs
 * visibly struggled with it at desktop settings — reported directly by
 * the user testing on a phone/tablet, not assumed from a benchmark.
 */
export function isLowPowerDevice(): boolean {
  return isTouchOnlyDevice();
}
