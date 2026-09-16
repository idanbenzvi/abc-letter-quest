// Device-tilt (gyro/accelerometer) input for the flight camera's parallax
// — the tablet/phone equivalent of the desktop mouse-look in
// FlightScene.tsx. Same output contract as the mouse: a normalized
// (-1..1, -1..1) "where is the viewer looking" pair that FlightScene
// damps heavily before use, so tilt and mouse feel identical downstream.
//
// Two things a naive `deviceorientation` listener gets wrong, both
// handled here:
//  1. There is no "correct" way to hold a tablet. The neutral pose is
//     whatever the child was doing when the flight started, and it
//     drifts slowly toward however they're holding it now (a ~10s time
//     constant — long enough that a deliberate tilt still reads as a
//     tilt, short enough that slumping into the sofa doesn't leave the
//     camera permanently craned upward). Racing games call this
//     auto-centering.
//  2. The raw beta/gamma axes are in DEVICE space; in landscape the
//     screen's left/right is the device's up/down. Remapped per
//     screen.orientation.angle below.
//
// iOS 13+ requires DeviceOrientationEvent.requestPermission() to be
// called from a user gesture — FlightGameScreen does that on the "Take
// Off!" tap. Everywhere else, events just flow (on a secure context).

type Listener = (x: number, y: number) => void;

const listeners = new Set<Listener>();
let enabled = false;
let attached = false;
let neutral: { x: number; y: number } | null = null;
let lastEventAt = 0;
let lastSampleAt = 0;

/** Degrees of tilt away from neutral that maps to the full ±1 parallax. Small on purpose — a tablet on a lap moves a lot. */
const FULL_TILT_DEGREES = 11;
/** Time constant (seconds) for the neutral pose to follow a sustained new holding position. */
const AUTO_CENTER_SECONDS = 10;
/** Tilt counts as "live" (and mouse input is ignored) for this long after the last sensor event. */
const LIVE_WINDOW_MS = 1500;

/** True only on touch-first devices that expose orientation events — a laptop with a stray accelerometer must not fight its own trackpad. */
export function isTiltCapable(): boolean {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return false;
  return window.matchMedia?.('(hover: none) and (pointer: coarse)').matches ?? false;
}

/**
 * Must be called inside a user gesture (a tap handler) on iOS, where it
 * shows the one-time permission sheet. Resolves true once tilt events
 * are flowing. Safe to call every take-off — a no-op after the first.
 */
export async function requestTiltPermission(): Promise<boolean> {
  if (!isTiltCapable()) return false;
  if (enabled) return true;
  const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> };
  if (typeof DOE.requestPermission === 'function') {
    try {
      enabled = (await DOE.requestPermission()) === 'granted';
    } catch {
      enabled = false;
    }
  } else {
    enabled = true;
  }
  if (enabled) attach();
  return enabled;
}

/** True while real tilt readings are arriving — FlightScene uses this to ignore the synthetic mousemove a touch tap can fire. */
export function isTiltLive(): boolean {
  return enabled && performance.now() - lastEventAt < LIVE_WINDOW_MS;
}

export function subscribeTilt(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Forget the neutral pose — the next reading becomes the new "straight ahead". Called at every take-off. */
export function recenterTilt(): void {
  neutral = null;
}

function screenAngle(): number {
  if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return typeof legacy === 'number' ? legacy : 0;
}

/**
 * Device-space beta (front/back tilt, about the device's left-right
 * axis) and gamma (left/right tilt, about its top-bottom axis) into
 * SCREEN-space "look right" (+x) and "look down" (+y), for each of the
 * four screen rotations. Sign convention chosen so that tilting the
 * screen's top edge away from you looks down, and dipping the screen's
 * right edge looks right — i.e. the screen behaves like a window you're
 * pointing. If a device reports the opposite sense for one rotation,
 * this table is the single place to flip it.
 */
function toScreenSpace(beta: number, gamma: number): { x: number; y: number } {
  switch (((screenAngle() % 360) + 360) % 360) {
    case 90:
      return { x: -beta, y: -gamma };
    case 180:
      return { x: -gamma, y: beta };
    case 270:
      return { x: beta, y: gamma };
    default:
      return { x: gamma, y: -beta };
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function onOrientation(e: DeviceOrientationEvent): void {
  if (e.beta === null || e.gamma === null || e.beta === undefined || e.gamma === undefined) return;
  const now = performance.now();
  const { x, y } = toScreenSpace(e.beta, e.gamma);
  if (!neutral) {
    neutral = { x, y };
    lastSampleAt = now;
  } else {
    const dt = Math.min(0.25, (now - lastSampleAt) / 1000);
    lastSampleAt = now;
    const k = 1 - Math.exp(-dt / AUTO_CENTER_SECONDS);
    neutral.x += (x - neutral.x) * k;
    neutral.y += (y - neutral.y) * k;
  }
  lastEventAt = now;
  const nx = clamp((x - neutral.x) / FULL_TILT_DEGREES, -1, 1);
  const ny = clamp((y - neutral.y) / FULL_TILT_DEGREES, -1, 1);
  listeners.forEach((l) => l(nx, ny));
}

function attach(): void {
  if (attached) return;
  attached = true;
  window.addEventListener('deviceorientation', onOrientation);
  // A rotation changes which device axis is "screen right" — the old
  // neutral pose is meaningless in the new frame, so start fresh.
  window.addEventListener('orientationchange', recenterTilt);
  screen.orientation?.addEventListener?.('change', recenterTilt);
}
