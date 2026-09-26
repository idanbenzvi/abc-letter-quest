import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as sfx from '../engine/sfx';

// The storm round's weather (see FlightScene's STORM_* and engine/oddSound.ts):
// rain streaking past the camera, and lightning — a jagged bolt far out
// over the sea, a flash that lights the whole frame (OceanSky's flashRef
// and the scene lights both read it), and thunder a beat later.
//
// `levelRef` is the storm's intensity: 0 = clear, 1 = full storm. It's
// eased by FlightScene; this component only reads it.

const DROPS = 900;
const STREAK = 0.9;
const FALL_SPEED = 24;
const WIND_X = -3.5;
// The rain lives in a box around the camera, recycled as it falls or
// drifts out, so it's always all around wherever the bird has flown.
const BOX_X = 16;
const BOX_Y_BELOW = 4;
const BOX_Y_ABOVE = 14;
const BOX_Z_BEHIND = 2;
const BOX_Z_AHEAD = 34;
const BOLT_SEGMENTS = 14;
const BOLT_SECONDS = 0.22;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function StormWeather({
  levelRef,
  flashRef,
  active,
  strikeKey = 0,
}: {
  levelRef: React.RefObject<number>;
  flashRef: React.RefObject<number>;
  active: boolean;
  /** Bumping this strikes right now, straight ahead — Storm Vowels' "lightning hits the word" payoff. */
  strikeKey?: number;
}) {
  const lines = useRef<THREE.LineSegments>(null);
  const drops = useMemo(() => {
    const p = new Float32Array(DROPS * 3);
    for (let i = 0; i < DROPS; i++) p.set([rand(-BOX_X, BOX_X), rand(-BOX_Y_BELOW, BOX_Y_ABOVE), rand(-BOX_Z_AHEAD, BOX_Z_BEHIND)], i * 3);
    return p; // camera-relative offsets
  }, []);
  const rainGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DROPS * 6), 3));
    return g;
  }, []);
  const boltGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((BOLT_SEGMENTS + 1) * 3), 3));
    return g;
  }, []);
  // A plain THREE.Line via <primitive>: R3F's <line> JSX collides with SVG's <line> element type.
  const bolt = useMemo(() => {
    const line = new THREE.Line(boltGeometry, new THREE.LineBasicMaterial({ color: '#f4f7ff', transparent: true, opacity: 1, depthWrite: false, toneMapped: false }));
    line.frustumCulled = false;
    line.visible = false;
    return line;
  }, [boltGeometry]);
  const lightning = useRef({ wait: rand(1.5, 3), boltAge: -1, thunderIn: -1, flash: 0 });
  const activeRef = useRef(active);
  activeRef.current = active;
  const seenStrike = useRef(strikeKey);
  const strikeKeyRef = useRef(strikeKey);
  strikeKeyRef.current = strikeKey;

  function strike(camera: THREE.Camera, ahead = false) {
    // A jagged bolt from the cloud base to the sea — usually well out and
    // to one side; `ahead` puts it dead centre, nearer (a deliberate hit).
    const pos = boltGeometry.getAttribute('position') as THREE.BufferAttribute;
    const side = Math.random() < 0.5 ? -1 : 1;
    let x = ahead ? camera.position.x + rand(-2, 2) : camera.position.x + side * rand(12, 30);
    const z = camera.position.z - (ahead ? rand(35, 45) : rand(55, 90));
    const top = 34;
    for (let i = 0; i <= BOLT_SEGMENTS; i++) {
      const t = i / BOLT_SEGMENTS;
      pos.setXYZ(i, x, top * (1 - t) + 0.5 * t, z + rand(-1.5, 1.5));
      x += rand(-2.2, 2.2);
    }
    pos.needsUpdate = true;
    const l = lightning.current;
    l.boltAge = 0;
    l.flash = 1;
    // Sound is slower than light: thunder follows the flash by a beat.
    l.thunderIn = rand(0.25, 0.9);
  }

  useFrame(({ camera }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const level = Math.max(0, levelRef.current ?? 0);
    const l = lightning.current;

    // --- lightning ---
    if (strikeKeyRef.current !== seenStrike.current) {
      seenStrike.current = strikeKeyRef.current;
      strike(camera, true);
      l.thunderIn = 0.12; // close by: the thunder follows almost at once
    }
    if (activeRef.current && level > 0.8) {
      l.wait -= delta;
      if (l.wait <= 0) {
        strike(camera);
        l.wait = rand(3.5, 7);
      }
    }
    if (l.thunderIn >= 0) {
      l.thunderIn -= delta;
      if (l.thunderIn < 0) sfx.play('thunder');
    }
    // A real flash flickers: a bright hit, a dip, a second, fainter hit.
    if (l.boltAge >= 0) {
      l.boltAge += delta;
      const a = l.boltAge;
      l.flash = a < 0.06 ? 1 : a < 0.1 ? 0.25 : a < 0.16 ? 0.7 : Math.max(0, 0.7 - (a - 0.16) * 3);
      if (a > 0.5) l.boltAge = -1;
    } else {
      l.flash = 0;
    }
    flashRef.current = l.flash;
    bolt.visible = l.boltAge >= 0 && l.boltAge < BOLT_SECONDS;
    (bolt.material as THREE.LineBasicMaterial).opacity = l.boltAge < 0.1 ? 1 : 0.6;

    // --- rain ---
    if (!lines.current) return;
    lines.current.visible = level > 0.01;
    if (!lines.current.visible) return;
    (lines.current.material as THREE.LineBasicMaterial).opacity = 0.42 * level;
    const pos = rainGeometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    const len = Math.hypot(WIND_X, FALL_SPEED);
    const sx = (WIND_X / len) * STREAK;
    const sy = (-FALL_SPEED / len) * STREAK;
    for (let i = 0; i < DROPS; i++) {
      const o = i * 3;
      drops[o] += WIND_X * delta;
      drops[o + 1] -= FALL_SPEED * delta;
      if (drops[o + 1] < -BOX_Y_BELOW) {
        drops[o + 1] += BOX_Y_BELOW + BOX_Y_ABOVE;
        drops[o] = rand(-BOX_X, BOX_X);
        drops[o + 2] = rand(-BOX_Z_AHEAD, BOX_Z_BEHIND);
      }
      if (drops[o] < -BOX_X) drops[o] += 2 * BOX_X;
      const x = cx + drops[o];
      const y = cy + drops[o + 1];
      const z = cz + drops[o + 2];
      const v = i * 6;
      arr[v] = x;
      arr[v + 1] = y;
      arr[v + 2] = z;
      arr[v + 3] = x + sx;
      arr[v + 4] = y + sy;
      arr[v + 5] = z;
    }
    pos.needsUpdate = true;
  });

  return (
    <>
      <lineSegments ref={lines} geometry={rainGeometry} frustumCulled={false} visible={false}>
        <lineBasicMaterial color="#d8e2ee" transparent opacity={0} depthWrite={false} />
      </lineSegments>
      <primitive object={bolt} />
    </>
  );
}
