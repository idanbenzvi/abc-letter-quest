import { useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import * as THREE from 'three';
import { STL_URL } from './flightPreload';
import {
  SHOULDER_Z,
  ELBOW_Z,
  WRIST_Z,
  SHOULDER_XY,
  ELBOW_XY,
  WRIST_XY,
  g1,
  g2,
  phaseOf,
  WINGBEAT_PERIOD_SECONDS,
  DIHEDRAL_DOWNSTROKE,
  DIHEDRAL_UPSTROKE,
  ELBOW_BEND_PEAK,
  WRIST_BEND_PEAK,
} from './albatrossRig';

/**
 * Extracts the triangles whose average Z (the model's raw wingspan
 * axis, before the group-level rotation below remaps it into the
 * game's world X) falls in [zMin, zMax), re-centered on `pivot` so the
 * result can be rotated as a rigid segment around that joint. Necessary
 * because this STL is a single fused, watertight mesh (no separate
 * objects — confirmed by a connected-components check: exactly one
 * island across all 50k triangles) with no rig, so there's no other way
 * to animate it than cutting it ourselves.
 */
function extractBand(geometry: THREE.BufferGeometry, zMin: number, zMax: number, pivot: THREE.Vector3): THREE.BufferGeometry {
  const posAttr = geometry.attributes.position;
  const normAttr = geometry.attributes.normal;
  const triCount = posAttr.count / 3;
  const idx: number[] = [];
  for (let t = 0; t < triCount; t++) {
    let zSum = 0;
    for (let k = 0; k < 3; k++) zSum += posAttr.getZ(t * 3 + k);
    const zAvg = zSum / 3;
    if (zAvg >= zMin && zAvg < zMax) idx.push(t);
  }

  const positions = new Float32Array(idx.length * 9);
  const normals = new Float32Array(idx.length * 9);
  let w = 0;
  for (const t of idx) {
    for (let k = 0; k < 3; k++) {
      const i = t * 3 + k;
      positions[w] = posAttr.getX(i) - pivot.x;
      positions[w + 1] = posAttr.getY(i) - pivot.y;
      positions[w + 2] = posAttr.getZ(i) - pivot.z;
      normals[w] = normAttr.getX(i);
      normals[w + 1] = normAttr.getY(i);
      normals[w + 2] = normAttr.getZ(i);
      w += 3;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return geo;
}

// The STL has geometry only — no UVs, material, or color (see the file
// header comment on AlbatrossModel below), so a normal image `map`
// texture has nothing to wrap onto. Real albatrosses do have a
// distinctive pattern worth having, though (mostly white body, dark
// upperwings, pale underwings) — vertex colors give that without
// needing UVs at all: a first-class, fully-supported Three.js material
// feature (`meshStandardMaterial vertexColors`), computed once per band
// below from each triangle's own position, entirely procedural like
// every other texture in this game (puffs, stars, plane banners — see
// cloudLetter.ts/planeTexture.ts). `color="#ffffff"` on the material
// itself matters: Three.js multiplies the material color against each
// vertex color, so anything but white would tint every band toward it.
const material = () => <meshStandardMaterial color="#ffffff" vertexColors roughness={0.78} />;

function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Cheap layered value noise (no library) — just needs to read as organic mottling at this scale, not be a rigorous noise function. */
function plumageNoise(x: number, y: number, z: number): number {
  let n = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < 3; o++) {
    n += hash3(x * f, y * f, z * f) * amp;
    amp *= 0.5;
    f *= 2.3;
  }
  return n; // roughly 0..1
}

/**
 * Colors one already-extracted band (body, or one wing segment) per
 * vertex, blending `light` (the band's own local Y minimum — its
 * underside/ventral surface) toward `dark` (its Y maximum — topside/
 * dorsal) using a smoothstep threshold plus a little noise-driven
 * mottling so it doesn't read as a flat, ruled gradient. Each band's Y
 * range is read fresh per-band (not the whole bird's), so this works
 * whether the band is the body (tall) or a wing segment (thin — its
 * "top" and "bottom" are really just the wing's upper/lower airfoil
 * surface, a much smaller Y span, which is exactly why per-band bounds
 * matter here instead of one shared bird-wide range).
 */
function applyPlumageColors(
  geometry: THREE.BufferGeometry,
  light: THREE.Color,
  dark: THREE.Color,
  { darkStart = 0.35, darkEnd = 0.75, noiseAmount = 0.16, noiseFreq = 3 }: { darkStart?: number; darkEnd?: number; noiseAmount?: number; noiseFreq?: number } = {},
): void {
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;
  const ySpan = Math.max(1e-4, bbox.max.y - bbox.min.y);
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = (y - bbox.min.y) / ySpan;
    const n = plumageNoise(x * noiseFreq, y * noiseFreq, z * noiseFreq) - 0.5;
    const mix = THREE.MathUtils.clamp(THREE.MathUtils.smoothstep(t, darkStart, darkEnd) + n * noiseAmount, 0, 1);
    c.copy(light).lerp(dark, mix);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// Body: overwhelmingly white/cream, same warm tone the flat color used
// to be — only a soft warming toward the mantle right at the very top
// (darkStart/darkEnd pushed high) so it stays a mostly-white bird, not
// a two-tone one.
const BODY_LIGHT = new THREE.Color('#f7f2e6');
const BODY_DARK = new THREE.Color('#d9cdb8');
// Wings: the reverse balance — mostly dark on top, pale underneath. The
// chase camera sits above-and-behind the bird (see FlightScene's doc
// comment), so the topside is what's actually in frame most of the
// flight — darkStart/darkEnd pulled low so that dark tone dominates the
// visible surface instead of being a thin edge a player would rarely see.
const WING_LIGHT = new THREE.Color('#efe6d2');
const WING_DARK = new THREE.Color('#463c33');

/** One wing's shoulder->elbow->wrist chain, mirrored via `sign` (+1 right, -1 left). See docs/10-flight-game.md. */
function WingSide({ geometry, sign }: { geometry: THREE.BufferGeometry; sign: 1 | -1 }) {
  const shoulderRef = useRef<THREE.Group>(null);
  const elbowRef = useRef<THREE.Group>(null);
  const wristRef = useRef<THREE.Group>(null);

  const { upperArm, forearm, hand, shoulderPos, elbowPos, wristPos } = useMemo(() => {
    const shoulderPos = new THREE.Vector3(SHOULDER_XY[0], SHOULDER_XY[1], sign * SHOULDER_Z);
    const elbowPos = new THREE.Vector3(ELBOW_XY[0], ELBOW_XY[1], sign * ELBOW_Z);
    const wristPos = new THREE.Vector3(WRIST_XY[0], WRIST_XY[1], sign * WRIST_Z);
    const zLo = (a: number, b: number) => (sign > 0 ? [a, b] : [-b, -a]);
    const [armMin, armMax] = zLo(SHOULDER_Z, ELBOW_Z);
    const [foreMin, foreMax] = zLo(ELBOW_Z, WRIST_Z);
    const [handMin, handMax] = zLo(WRIST_Z, 10);
    const upperArm = extractBand(geometry, armMin, armMax, shoulderPos);
    const forearm = extractBand(geometry, foreMin, foreMax, elbowPos);
    const hand = extractBand(geometry, handMin, handMax, wristPos);
    for (const band of [upperArm, forearm, hand]) applyPlumageColors(band, WING_LIGHT, WING_DARK, { darkStart: 0.15, darkEnd: 0.55 });
    return { upperArm, forearm, hand, shoulderPos, elbowPos, wristPos };
  }, [geometry, sign]);

  // Rotation sign: each segment's geometry is re-centered on its own
  // joint, so its local Z keeps the ORIGINAL side's sign (negative for
  // the whole left wing, positive for the whole right) — rotating both
  // sides by the identical angle around local X would raise one wing
  // and lower the other (a roll, not a flap). Negating by `sign` makes
  // both wings move the same way. Verified visually, not just by the
  // algebra: confirmed via screenshot that the wings flap up/down
  // together, not seesaw.
  useFrame(({ clock }) => {
    const phi = phaseOf(clock.getElapsedTime(), WINGBEAT_PERIOD_SECONDS);
    const dihedral = g1(DIHEDRAL_DOWNSTROKE, DIHEDRAL_UPSTROKE, phi);
    const elbowBend = g2(0, ELBOW_BEND_PEAK, phi);
    const wristBend = g2(0, WRIST_BEND_PEAK, phi);
    if (shoulderRef.current) shoulderRef.current.rotation.x = -sign * dihedral;
    if (elbowRef.current) elbowRef.current.rotation.x = -sign * elbowBend;
    if (wristRef.current) wristRef.current.rotation.x = -sign * wristBend;
  });

  return (
    <group ref={shoulderRef} position={shoulderPos}>
      <mesh geometry={upperArm}>{material()}</mesh>
      <group ref={elbowRef} position={elbowPos.clone().sub(shoulderPos)}>
        <mesh geometry={forearm}>{material()}</mesh>
        <group ref={wristRef} position={wristPos.clone().sub(elbowPos)}>
          <mesh geometry={hand}>{material()}</mesh>
        </group>
      </group>
    </group>
  );
}

/**
 * The real albatross model — a binary STL (geometry only, no material/
 * rig/animation) the user downloaded and dropped at
 * public/models/albatross.stl, replacing the old geometric
 * AlbatrossPlaceholder (removed — this fully supersedes it).
 *
 * Orientation: the file's wingspan turned out to be its LONGEST raw
 * axis (Z, ~1.19 units) — initially mistaken for "forward" (X, only
 * ~0.47), which produced a too-large, oddly-posed bird. Confirmed the
 * real axis layout by rendering the raw mesh from front/top/side/iso in
 * an isolated scene with axis helpers, not by guessing again. The
 * `rotation={[0, Math.PI/2, 0]}` below remaps that Z wingspan onto the
 * game's world X (left-right on screen) and points the beak toward
 * world -Z (away from the chase camera, matching flight direction).
 * Scale (2.3) was then tuned against the corrected axis to roughly
 * match the wingspan the old placeholder read as on screen.
 *
 * Wing rig: a real shoulder->elbow->wrist chain per side (see
 * `WingSide` above and `albatrossRig.ts` for the joint positions and
 * the Wu & Popović 2003 wingbeat equations driving it), not the earlier
 * single-hinge split — see docs/10-flight-game.md for the full story.
 */
export function AlbatrossModel({ scale = 1 }: { scale?: number }) {
  const raw = useLoader(STLLoader, STL_URL) as THREE.BufferGeometry;

  const { body, geometry } = useMemo(() => {
    const geo = raw.clone();
    geo.computeBoundingBox();
    const center = new THREE.Vector3();
    geo.boundingBox!.getCenter(center);
    geo.translate(-center.x, -center.y, -center.z);
    geo.computeVertexNormals();
    const body = extractBand(geo, -SHOULDER_Z, SHOULDER_Z, new THREE.Vector3(0, 0, 0));
    applyPlumageColors(body, BODY_LIGHT, BODY_DARK, { darkStart: 0.55, darkEnd: 0.92 });
    return { body, geometry: geo };
  }, [raw]);

  return (
    <group scale={scale} rotation={[0, Math.PI / 2, 0]}>
      <mesh geometry={body}>{material()}</mesh>
      <WingSide geometry={geometry} sign={-1} />
      <WingSide geometry={geometry} sign={1} />
    </group>
  );
}
