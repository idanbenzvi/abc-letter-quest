import { isLowPowerDevice } from '../engine/preload';

// Live frame-rate calibration for the flight scene. One number, `quality`
// (0..1), is nudged by measured fps and drives three levers, top down:
//
//   1 → 0.8    ocean SUPERSAMPLING: the sea renders above screen
//              resolution (up to 1.5x), smoothing its shimmering glints.
//              Only reached by climbing, on a machine with fps to spare.
//   0.8 → 0.3  ocean DETAIL: march steps + wave counts, gliding via
//              uniforms with no recompile (see oceanSky.ts's
//              oceanDetailUniforms).
//   0.3 → 0.12 ocean RESOLUTION: the sea alone renders at down to half
//              resolution and is upscaled; the letters, bird and UI stay
//              sharp.
//   below 0.12 canvas resolution (device pixel ratio), in a few discrete
//              steps since every DPR change reallocates the canvas — the
//              last resort, because it softens everything.
//
// The fullscreen ocean is by far the scene's biggest cost (it scales with
// pixels, not geometry), which is why it's the thing calibrated first.

const SUPER_FROM = 0.8;
const DETAIL_FROM = 0.3;
const SCALE_FROM = 0.12;
/** Most the sea is supersampled — and never beyond 2 rendered pixels per CSS pixel in total. */
const MAX_OCEAN_SUPERSAMPLE = 1.5;
const MIN_OCEAN_SCALE = 0.5;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * `?quality=0..1` in the URL pins the level and switches calibration off
 * — for comparing tiers side by side on a real device (1 = supersampled,
 * 0.8 = full detail, 0.3 = detail floor, 0.12 = half-resolution sea).
 */
export const PINNED_QUALITY: number | null = (() => {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('quality');
  const value = raw === null ? NaN : Number(raw);
  return Number.isFinite(value) ? clamp01(value) : null;
})();

/** Touch devices start a little into the detail band (≈ the old low tier) and calibrate from there; desktops start at full detail without supersampling, and climb into it if they have headroom. */
export const INITIAL_QUALITY = PINNED_QUALITY ?? (isLowPowerDevice() ? 0.42 : SUPER_FROM);

/** Touch devices have historically been capped at dpr 1 (fullscreen raymarch on a 3x phone screen is hopeless); desktops up to 2. */
export function maxDpr(): number {
  const native = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.min(native, isLowPowerDevice() ? 1 : 2);
}

export function oceanDetailFromQuality(quality: number): number {
  return clamp01((quality - DETAIL_FROM) / (SUPER_FROM - DETAIL_FROM));
}

/**
 * The sea's own render scale relative to the canvas: above 1 is
 * supersampling, below 1 renders it smaller and upscales. Quantised to
 * eighths, since each change reallocates the sea's render target.
 */
export function oceanScaleFromQuality(quality: number, dpr: number): number {
  let scale = 1;
  if (quality >= SUPER_FROM) {
    const top = Math.max(1, Math.min(MAX_OCEAN_SUPERSAMPLE, 2 / dpr));
    scale = 1 + (top - 1) * clamp01((quality - SUPER_FROM) / (1 - SUPER_FROM));
  } else if (quality < DETAIL_FROM) {
    scale = MIN_OCEAN_SCALE + (1 - MIN_OCEAN_SCALE) * clamp01((quality - SCALE_FROM) / (DETAIL_FROM - SCALE_FROM));
  }
  return Math.round(scale * 8) / 8;
}

export function dprFromQuality(quality: number): number {
  const top = maxDpr();
  if (quality >= SCALE_FROM) return top;
  if (quality >= 0.08) return Math.min(1.5, top);
  if (quality >= 0.04) return Math.min(1, top);
  return Math.min(0.75, top);
}
