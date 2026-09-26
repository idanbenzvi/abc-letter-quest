import { isLowPowerDevice } from '../engine/preload';

// Live frame-rate calibration for the flight scene. One number, `quality`
// (0..1), is nudged by measured fps and drives two levers in order:
//   1. the ocean shader's detail (march steps + wave octaves) — glides
//      continuously via uniforms, no recompile (see oceanSky.ts's
//      oceanDetailUniforms);
//   2. only once the ocean is already at its floor, render resolution
//      (device pixel ratio) — in a few discrete steps, since every DPR
//      change reallocates the canvas.
// The fullscreen ocean is by far the scene's biggest cost (it scales
// with pixels, not geometry), which is why it's the thing calibrated.

/** Where the ocean-detail lever ends and the resolution lever begins. */
const DETAIL_FROM = 0.25;

/** Touch devices start where the old fixed "low" tier was (≈16 steps, dpr 1) and calibrate from there; desktops start at full. */
export const INITIAL_QUALITY = isLowPowerDevice() ? 0.45 : 1;

/** Touch devices have historically been capped at dpr 1 (fullscreen raymarch on a 3x phone screen is hopeless); desktops up to 2. */
export function maxDpr(): number {
  const native = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.min(native, isLowPowerDevice() ? 1 : 2);
}

export function oceanDetailFromQuality(quality: number): number {
  return Math.min(1, Math.max(0, (quality - DETAIL_FROM) / (1 - DETAIL_FROM)));
}

export function dprFromQuality(quality: number): number {
  const top = maxDpr();
  if (quality >= DETAIL_FROM) return top;
  if (quality >= 0.17) return Math.min(1.5, top);
  if (quality >= 0.08) return Math.min(1, top);
  return Math.min(0.75, top);
}
