// Shared between AlbatrossModel.tsx (the actual animated rig) and
// RigTool.tsx (which seeds these as visible/editable starting joints so
// they can be sanity-checked and nudged in 3D, not just trusted as
// numbers in code) — see docs/10-flight-game.md for how these were
// derived and why the equations are what they are.

/**
 * Estimated, not measured or hand-placed: cross-section centroids
 * sampled directly from the mesh at span-fractions matching typical
 * albatross wing-skeleton proportions (shoulder->elbow ~18%,
 * elbow->wrist ~23%, wrist->tip ~59% of the exposed wing — a long,
 * high-aspect-ratio "hand-wing" typical of dynamic-soaring seabirds).
 * The shoulder station itself (0.075) was located geometrically, not
 * guessed: the body's front-to-back cross-section thickness drops
 * sharply between z=0.06 and z=0.08 in the centered mesh — that's
 * where the torso ends and the thin wing begins.
 */
export const SHOULDER_Z = 0.075;
export const ELBOW_Z = 0.169;
export const WRIST_Z = 0.289;
export const TIP_Z = 0.58;

// X/Y centroids at each station, averaged across both (nearly
// symmetric) sides of the sampled mesh.
export const SHOULDER_XY: [number, number] = [-0.0316, 0.0236];
export const ELBOW_XY: [number, number] = [-0.0278, 0.0546];
export const WRIST_XY: [number, number] = [-0.0124, 0.0702];
export const TIP_XY: [number, number] = [-0.0118, 0.063];

export interface JointSeed {
  name: string;
  parent: string | null;
  position: [number, number, number];
}

/** A body root plus a shoulder->elbow->wrist->wingtip chain per side. */
export const ESTIMATED_JOINTS: JointSeed[] = [
  { name: 'root', parent: null, position: [0, 0, 0] },
  { name: 'leftShoulder', parent: 'root', position: [SHOULDER_XY[0], SHOULDER_XY[1], -SHOULDER_Z] },
  { name: 'leftElbow', parent: 'leftShoulder', position: [ELBOW_XY[0], ELBOW_XY[1], -ELBOW_Z] },
  { name: 'leftWrist', parent: 'leftElbow', position: [WRIST_XY[0], WRIST_XY[1], -WRIST_Z] },
  { name: 'leftWingtip', parent: 'leftWrist', position: [TIP_XY[0], TIP_XY[1], -TIP_Z] },
  { name: 'rightShoulder', parent: 'root', position: [SHOULDER_XY[0], SHOULDER_XY[1], SHOULDER_Z] },
  { name: 'rightElbow', parent: 'rightShoulder', position: [ELBOW_XY[0], ELBOW_XY[1], ELBOW_Z] },
  { name: 'rightWrist', parent: 'rightElbow', position: [WRIST_XY[0], WRIST_XY[1], WRIST_Z] },
  { name: 'rightWingtip', parent: 'rightWrist', position: [TIP_XY[0], TIP_XY[1], TIP_Z] },
];

/**
 * Wingbeat composite functions, straight from Wu & Popović 2003 (see
 * docs/10-flight-game.md) — pure functions of phase, no physics
 * simulation. `phi` runs 0→2π per wingbeat; 0 is the start of the
 * downstroke, π is downstroke-end/upstroke-start, 2π is upstroke-end.
 *
 * g1: a smooth full-cycle oscillation between the upstroke value (at
 * phi=0 and 2π) and the downstroke value (at phi=π) — used here for
 * shoulder dihedral, the main up/down flap.
 *
 * g2: holds flat at the downstroke value for the whole downstroke, then
 * smoothly swings out to the upstroke value and back during the
 * upstroke — used here for elbow/wrist bend, matching the paper's
 * description of real birds folding the wing inward only on the
 * upstroke (to reduce drag) and holding it extended through the power
 * stroke.
 */
export function g1(down: number, up: number, phi: number): number {
  return ((up - down) * (1 + Math.cos(phi))) / 2 + down;
}

export function g2(down: number, up: number, phi: number): number {
  if (phi < Math.PI) return down;
  return ((up - down) * (1 - Math.cos(2 * phi))) / 2 + down;
}

export function phaseOf(elapsedSeconds: number, periodSeconds: number): number {
  return ((elapsedSeconds / periodSeconds) % 1) * Math.PI * 2;
}

// Illustrative angle targets (radians) — the paper derives these per
// bird from wind-tunnel-informed optimization; we have neither real
// measurements nor an optimizer for this model, so these are chosen by
// eye for a clearly visible, unhurried "soaring seabird" flap rather
// than fitted to anything. WINGBEAT_PERIOD_SECONDS is similarly a
// deliberate pace choice, not a biomechanical value.
export const WINGBEAT_PERIOD_SECONDS = 2.2;
// -0.08 * 1.4 — the wingtips dip about 40% further below horizontal at
// the bottom of the downstroke, per direct request (they read as barely
// dipping below the body at all at the original value).
export const DIHEDRAL_DOWNSTROKE = -0.112;
export const DIHEDRAL_UPSTROKE = 0.45;
export const ELBOW_BEND_PEAK = 0.9;
export const WRIST_BEND_PEAK = 0.6;
