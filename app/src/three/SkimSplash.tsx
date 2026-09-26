import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// The albatross's skim-the-sea wake during the rainbow round (see
// FlightScene's SKIM_* constants): chunky cartoon droplets thrown up
// behind the bird and off a wingtip that clips a crest, a V of foam
// spreading on the water behind it, and a proper "sploosh" crown every
// time the bird belly-dips.
//
// The sea itself only exists inside the ocean shader, so there's no
// surface to collide with here — heights come from sampling that
// shader's own wave function offline (mean ≈ 0.7, 90th-percentile crest
// ≈ 1.1, max ≈ 1.5). The GPU's float32 sin() makes exact per-wave
// tracking impossible anyway; these statistics are what's used.
export const SEA_FOAM_Y = 0.8;
/** Height at which a wingtip reads as clipping the crests. */
export const SEA_CREST_Y = 1.15;

export interface SkimState {
  /** 0..1 — how far into the skim the bird is (eased). No emission below ~0.6. */
  intensity: number;
  body: THREE.Vector3;
  tips: [THREE.Vector3, THREE.Vector3];
  /** Bumped by FlightScene each time a belly-dip hits the water. */
  bursts: number;
  nightDim: number;
  /** Flight speed multiplier — the dash through the arch throws a longer, denser rooster tail. */
  speed: number;
}

const MAX_DROPS = 480;
const MAX_FOAM = 160;
// Snappier than real gravity — cartoon splashes hang, then drop fast.
const GRAVITY = -13;
const DRAG = 0.6;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function makeFoamTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  // A soft, lumpy blob rather than a perfect disc: several offset
  // radial gradients layered, so overlapping puffs read as churned foam.
  for (let i = 0; i < 7; i++) {
    const x = size / 2 + rand(-14, 14);
    const y = size / 2 + rand(-14, 14);
    const r = rand(26, 44);
    const grad = g.createRadialGradient(x, y, r * 0.2, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Drops {
  pos: Float32Array;
  vel: Float32Array;
  life: Float32Array; // remaining seconds; <= 0 = dead
  maxLife: Float32Array;
  size: Float32Array;
  next: number;
}
interface Foam {
  pos: Float32Array;
  drift: Float32Array; // xz
  age: Float32Array;
  life: Float32Array; // total seconds; 0 = dead
  from: Float32Array;
  to: Float32Array;
  strength: Float32Array;
  spin: Float32Array;
  next: number;
}

export function SkimSplash({ stateRef }: { stateRef: React.RefObject<SkimState> }) {
  const dropMesh = useRef<THREE.InstancedMesh>(null);
  const foamMesh = useRef<THREE.InstancedMesh>(null);
  const foamTexture = useMemo(() => makeFoamTexture(), []);

  const drops = useRef<Drops>({
    pos: new Float32Array(MAX_DROPS * 3),
    vel: new Float32Array(MAX_DROPS * 3),
    life: new Float32Array(MAX_DROPS),
    maxLife: new Float32Array(MAX_DROPS),
    size: new Float32Array(MAX_DROPS),
    next: 0,
  }).current;
  const foam = useRef<Foam>({
    pos: new Float32Array(MAX_FOAM * 3),
    drift: new Float32Array(MAX_FOAM * 2),
    age: new Float32Array(MAX_FOAM),
    life: new Float32Array(MAX_FOAM),
    from: new Float32Array(MAX_FOAM),
    to: new Float32Array(MAX_FOAM),
    strength: new Float32Array(MAX_FOAM),
    spin: new Float32Array(MAX_FOAM),
    next: 0,
  }).current;
  const acc = useRef({ body: 0, tip: 0, foam: 0, seenBursts: 0 }).current;
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3(), v: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), c: new THREE.Color(), flat: new THREE.Quaternion(), e: new THREE.Euler() }),
    [],
  );

  // The per-instance colour attribute has to exist before the material's
  // first compile, or three builds the shader without instance colours
  // and the foam's fade silently does nothing.
  useLayoutEffect(() => {
    const mesh = foamMesh.current;
    if (!mesh) return;
    const black = new THREE.Color(0, 0, 0);
    for (let i = 0; i < MAX_FOAM; i++) mesh.setColorAt(i, black);
    (mesh.material as THREE.Material).needsUpdate = true;
  }, []);

  function spawnDrop(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number) {
    const i = drops.next;
    drops.next = (i + 1) % MAX_DROPS;
    drops.pos.set([x, y, z], i * 3);
    drops.vel.set([vx, vy, vz], i * 3);
    drops.life[i] = drops.maxLife[i] = life;
    drops.size[i] = size;
  }
  function spawnFoam(x: number, z: number, dx: number, dz: number, from: number, to: number, life: number, strength: number) {
    const i = foam.next;
    foam.next = (i + 1) % MAX_FOAM;
    foam.pos.set([x, SEA_FOAM_Y + Math.random() * 0.02, z], i * 3);
    foam.drift.set([dx, dz], i * 2);
    foam.age[i] = 0;
    foam.life[i] = life;
    foam.from[i] = from;
    foam.to[i] = to;
    foam.strength[i] = strength;
    foam.spin[i] = Math.random() * Math.PI * 2;
  }

  function sploosh(at: THREE.Vector3) {
    // The crown: a ring of big drops flung outward and up.
    for (let k = 0; k < 150; k++) {
      const a = (k / 150) * Math.PI * 2 + rand(-0.1, 0.1);
      const sp = rand(1.8, 4.6);
      spawnDrop(at.x + Math.cos(a) * 0.35, SEA_FOAM_Y + 0.15, at.z + Math.sin(a) * 0.35, Math.cos(a) * sp, rand(3.6, 7), Math.sin(a) * sp + 1.2, rand(0.022, 0.055), rand(0.9, 1.4));
    }
    // ...and a central column, the comic "plume".
    for (let k = 0; k < 30; k++) {
      spawnDrop(at.x + rand(-0.2, 0.2), SEA_FOAM_Y + 0.2, at.z + rand(-0.2, 0.2), rand(-0.6, 0.6), rand(6, 8.5), rand(0.4, 1.6), rand(0.03, 0.06), rand(1.1, 1.5));
    }
    spawnFoam(at.x, at.z, 0, 0.8, 0.6, 4.2, 1.8, 1);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      spawnFoam(at.x + Math.cos(a) * 1.1, at.z + Math.sin(a) * 1.1, Math.cos(a) * 0.9, Math.sin(a) * 0.9 + 0.6, 0.4, 1.6, 1.4, 0.7);
    }
  }

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const st = stateRef.current;
    if (!st || !dropMesh.current || !foamMesh.current) return;
    const on = THREE.MathUtils.smoothstep(st.intensity, 0.6, 0.95);

    // --- emission ---
    if (st.bursts !== acc.seenBursts) {
      acc.seenBursts = st.bursts;
      sploosh(st.body);
    }
    if (on > 0) {
      // Keel spray: a constant fine rooster-tail thrown up behind the body.
      const rush = Math.min(st.speed, 4);
      acc.body += delta * 55 * on * rush;
      while (acc.body >= 1) {
        acc.body -= 1;
        const side = Math.random() < 0.5 ? -1 : 1;
        spawnDrop(st.body.x + side * rand(0.05, 0.25), SEA_FOAM_Y + 0.1, st.body.z + rand(0.1, 0.5), side * rand(0.3, 1.4) * rush, rand(1.4, 3.2) * Math.sqrt(rush), rand(0.6, 1.8), rand(0.02, 0.045), rand(0.5, 0.9));
      }
      // Wingtip spray: only from a tip actually down among the crests
      // (the bank swings them in turn), scaled by how deep it is.
      for (const tip of st.tips) {
        const depth = THREE.MathUtils.clamp((SEA_CREST_Y + 0.35 - tip.y) / 0.45, 0, 1);
        if (depth <= 0) continue;
        acc.tip += delta * 110 * depth * on;
        const outward = Math.sign(tip.x - st.body.x) || 1;
        while (acc.tip >= 1) {
          acc.tip -= 1;
          spawnDrop(tip.x + rand(-0.1, 0.1), SEA_FOAM_Y + 0.12, tip.z + rand(-0.1, 0.25), outward * rand(0.4, 2.0), rand(1.8, 4.2), rand(0.5, 2.2), rand(0.025, 0.055), rand(0.5, 1.0));
        }
        if (Math.random() < delta * 14 * depth) spawnFoam(tip.x, tip.z + 0.2, outward * 0.5, 0.4, 0.3, 1.3, 1.1, 0.6 * depth);
      }
      // The V wake: paired puffs left behind the body that drift apart.
      acc.foam += delta * 16 * on * rush;
      while (acc.foam >= 1) {
        acc.foam -= 1;
        for (const side of [-1, 1]) spawnFoam(st.body.x + side * 0.2, st.body.z + 0.35, side * 0.75, 0.25, 0.35, 1.5, 1.7, 0.75 * on);
      }
    }

    // --- simulate + write droplets ---
    const { m, q, s, p, v, up, c, flat, e } = tmp;
    for (let i = 0; i < MAX_DROPS; i++) {
      if (drops.life[i] <= 0) {
        m.makeScale(0, 0, 0);
        dropMesh.current.setMatrixAt(i, m);
        continue;
      }
      const o = i * 3;
      drops.vel[o + 1] += GRAVITY * delta;
      const k = 1 - DRAG * delta;
      drops.vel[o] *= k;
      drops.vel[o + 2] *= k;
      drops.pos[o] += drops.vel[o] * delta;
      drops.pos[o + 1] += drops.vel[o + 1] * delta;
      drops.pos[o + 2] += drops.vel[o + 2] * delta;
      drops.life[i] -= delta;
      // Back into the sea: gone, sometimes leaving a tiny foam ring.
      if (drops.pos[o + 1] < SEA_FOAM_Y && drops.vel[o + 1] < 0) {
        if (drops.size[i] > 0.05 && Math.random() < 0.25) spawnFoam(drops.pos[o], drops.pos[o + 2], 0, 0, 0.1, 0.55, 0.7, 0.45);
        drops.life[i] = 0;
      }
      p.set(drops.pos[o], drops.pos[o + 1], drops.pos[o + 2]);
      v.set(drops.vel[o], drops.vel[o + 1], drops.vel[o + 2]);
      const speed = v.length();
      if (speed > 1e-3) q.setFromUnitVectors(up, v.divideScalar(speed));
      // Stretched along its motion (a streak), shrinking away at the end.
      const fade = Math.min(1, drops.life[i] / (drops.maxLife[i] * 0.3));
      const r = drops.size[i] * fade;
      s.set(r, r * (1 + speed * 0.1), r);
      m.compose(p, q, s);
      dropMesh.current.setMatrixAt(i, m);
    }
    dropMesh.current.instanceMatrix.needsUpdate = true;

    // --- simulate + write foam ---
    const night = 1 - 0.6 * st.nightDim;
    for (let i = 0; i < MAX_FOAM; i++) {
      if (foam.life[i] <= 0) {
        m.makeScale(0, 0, 0);
        foamMesh.current.setMatrixAt(i, m);
        continue;
      }
      foam.age[i] += delta;
      const t = foam.age[i] / foam.life[i];
      if (t >= 1) {
        foam.life[i] = 0;
        m.makeScale(0, 0, 0);
        foamMesh.current.setMatrixAt(i, m);
        continue;
      }
      const o = i * 3;
      const slow = 1 - t; // drift decelerates as it spreads
      foam.pos[o] += foam.drift[i * 2] * delta * slow;
      foam.pos[o + 2] += foam.drift[i * 2 + 1] * delta * slow;
      const eased = 1 - (1 - t) * (1 - t);
      const scale = foam.from[i] + (foam.to[i] - foam.from[i]) * eased;
      flat.setFromEuler(e.set(-Math.PI / 2, 0, foam.spin[i] + t * 0.6));
      p.set(foam.pos[o], foam.pos[o + 1], foam.pos[o + 2]);
      s.set(scale, scale * 0.8, 1);
      m.compose(p, flat, s);
      foamMesh.current.setMatrixAt(i, m);
      // Additive: fading the instance colour toward black fades the puff out.
      const a = foam.strength[i] * Math.min(1, t * 8) * (1 - t) * (1 - t) * night;
      foamMesh.current.setColorAt(i, c.setScalar(a));
    }
    foamMesh.current.instanceMatrix.needsUpdate = true;
    if (foamMesh.current.instanceColor) foamMesh.current.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={foamMesh} args={[undefined, undefined, MAX_FOAM]} frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={foamTexture} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={dropMesh} args={[undefined, undefined, MAX_DROPS]} frustumCulled={false} renderOrder={2}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#eefaff" emissive="#bfe6fa" emissiveIntensity={0.4} roughness={0.05} metalness={0} transparent opacity={0.78} />
      </instancedMesh>
    </>
  );
}
