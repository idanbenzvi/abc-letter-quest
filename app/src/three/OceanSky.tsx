import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { oceanVertexShader, buildOceanFragmentShader, OCEAN_SKY_DEFAULTS, OCEAN_QUALITY_HIGH, type OceanQuality } from './oceanSky';

interface OceanSkyProps {
  /** 0-24. Drives the whole day/sunset/night blend inside the shader — see docs/07-architecture.md#flight-game. */
  timeOfDay?: number;
  /**
   * Alternative to `timeOfDay`: a ref whose `.current` is read directly
   * inside this component's OWN useFrame, every frame, bypassing React
   * entirely. Use this when the value changes continuously (e.g. a
   * mission clock advancing every frame) — a plain prop only reaches
   * this component's frame loop when this component itself re-renders,
   * which a value tucked in a parent's ref never triggers on its own.
   * Takes priority over `timeOfDay` when provided.
   */
  timeOfDayRef?: React.RefObject<number>;
  seaHeight?: number;
  seaChoppy?: number;
  seaFreq?: number;
  seaRipples?: number;
  seaSpeed?: number;
  /** Below: not previously exposed as props (only ever set from OCEAN_SKY_DEFAULTS at mount) — added so DevOceanPanel.tsx can tune the full palette, not just the wave/time shape. */
  starIntensity?: number;
  sunSize?: number;
  moonSize?: number;
  seaBaseColor?: [number, number, number];
  seaWaterColor?: [number, number, number];
  daySkyColor?: [number, number, number];
  sunsetSkyColor?: [number, number, number];
  nightSkyColor?: [number, number, number];
  sunColor?: [number, number, number];
  moonColor?: [number, number, number];
  /** Raymarch step/octave budget — see oceanSky.ts's OCEAN_QUALITY_LOW. Fixed for this component's lifetime (device tier doesn't change mid-session), so it's read once at mount, not tracked in `latest`. */
  quality?: OceanQuality;
}

/**
 * Fullscreen raymarched sky+ocean backdrop (see oceanSky.ts for the
 * shader itself and attribution). Renders depth-ignoring, first, as a
 * painted background — real 3D objects (bird, letter-clouds) render
 * normally in front of it with their own depth testing.
 *
 * Camera sync: rather than the shader driving its own implicit camera
 * (as the original demo did, via uCameraSpeed auto-advancing time),
 * this component reads the SCENE'S REAL active camera every frame and
 * feeds its actual position/rotation/fov in as the equivalent
 * uniforms — the real camera is the single source of truth, or the
 * backdrop and the real 3D objects would drift apart. Rotation is
 * passed through camera.rotation.x/y/z directly, which is an
 * approximation (the shader's fromEuler() is a hand-rolled matrix, not
 * guaranteed to exactly match Three's Euler convention) — acceptable
 * because the flight scene only ever banks the camera gently; a full
 * matrix-equivalence proof isn't worth it for a few degrees of tilt.
 *
 * IMPORTANT gotcha that cost real debugging time: R3F's `uniforms` prop
 * on `<shaderMaterial>` does NOT hand the material your object by
 * reference — it copies values into a separate internal uniforms
 * object at apply-time. Mutating the object you passed in as `uniforms`
 * (even via a stable useMemo reference) silently updates an orphaned
 * copy the material never reads again; verified via
 * `materialRef.current.uniforms !== uniforms` returning true. The fix,
 * used below: read/write `materialRef.current.uniforms.<name>.value`
 * directly inside useFrame — the JSX `uniforms` prop only seeds initial
 * values at mount.
 */
export function OceanSky({
  timeOfDay = OCEAN_SKY_DEFAULTS.timeOfDay,
  timeOfDayRef,
  seaHeight = OCEAN_SKY_DEFAULTS.seaHeight,
  seaChoppy = OCEAN_SKY_DEFAULTS.seaChoppy,
  seaFreq = OCEAN_SKY_DEFAULTS.seaFreq,
  seaRipples = OCEAN_SKY_DEFAULTS.seaRipples,
  seaSpeed = OCEAN_SKY_DEFAULTS.seaSpeed,
  starIntensity = OCEAN_SKY_DEFAULTS.starIntensity,
  sunSize = OCEAN_SKY_DEFAULTS.sunSize,
  moonSize = OCEAN_SKY_DEFAULTS.moonSize,
  seaBaseColor = OCEAN_SKY_DEFAULTS.seaBaseColor,
  seaWaterColor = OCEAN_SKY_DEFAULTS.seaWaterColor,
  daySkyColor = OCEAN_SKY_DEFAULTS.daySkyColor,
  sunsetSkyColor = OCEAN_SKY_DEFAULTS.sunsetSkyColor,
  nightSkyColor = OCEAN_SKY_DEFAULTS.nightSkyColor,
  sunColor = OCEAN_SKY_DEFAULTS.sunColor,
  moonColor = OCEAN_SKY_DEFAULTS.moonColor,
  quality = OCEAN_QUALITY_HIGH,
}: OceanSkyProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  // Built once per mount, keyed off `quality` — swapping it later would
  // need `material.needsUpdate = true` to force a shader recompile,
  // which nothing here does (device tier is decided once, at spawn).
  const fragmentShader = useMemo(() => buildOceanFragmentShader(quality), [quality]);
  const worldDir = useRef(new THREE.Vector3()).current;

  // useFrame's callback closure isn't reliable for fresh prop values
  // either (observed going stale under testing) — read from a ref,
  // updated every render, same fix in spirit as the uniforms gotcha.
  const latest = useRef({
    timeOfDay,
    seaHeight,
    seaChoppy,
    seaFreq,
    seaRipples,
    seaSpeed,
    starIntensity,
    sunSize,
    moonSize,
    seaBaseColor,
    seaWaterColor,
    daySkyColor,
    sunsetSkyColor,
    nightSkyColor,
    sunColor,
    moonColor,
  });
  latest.current = {
    timeOfDay,
    seaHeight,
    seaChoppy,
    seaFreq,
    seaRipples,
    seaSpeed,
    starIntensity,
    sunSize,
    moonSize,
    seaBaseColor,
    seaWaterColor,
    daySkyColor,
    sunsetSkyColor,
    nightSkyColor,
    sunColor,
    moonColor,
  };

  const initialUniforms = useMemo(
    () => ({
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector3(1, 1, 1) },
      uTimeOfDay: { value: timeOfDay },
      uStarIntensity: { value: OCEAN_SKY_DEFAULTS.starIntensity },
      uSunSize: { value: OCEAN_SKY_DEFAULTS.sunSize },
      uMoonSize: { value: OCEAN_SKY_DEFAULTS.moonSize },
      uSeaBaseColor: { value: new THREE.Vector3(...OCEAN_SKY_DEFAULTS.seaBaseColor) },
      uSeaWaterColor: { value: new THREE.Vector3(...OCEAN_SKY_DEFAULTS.seaWaterColor) },
      uDaySkyColor: { value: new THREE.Vector3(...OCEAN_SKY_DEFAULTS.daySkyColor) },
      uSunsetSkyColor: { value: new THREE.Vector3(...OCEAN_SKY_DEFAULTS.sunsetSkyColor) },
      uNightSkyColor: { value: new THREE.Vector3(...OCEAN_SKY_DEFAULTS.nightSkyColor) },
      uSunColor: { value: new THREE.Vector3(...OCEAN_SKY_DEFAULTS.sunColor) },
      uMoonColor: { value: new THREE.Vector3(...OCEAN_SKY_DEFAULTS.moonColor) },
      uSeaHeight: { value: seaHeight },
      uSeaChoppy: { value: seaChoppy },
      uSeaFreq: { value: seaFreq },
      uSeaRipples: { value: seaRipples },
      uSeaSpeed: { value: seaSpeed },
      uCameraSpeed: { value: 0 }, // real camera drives forward motion, not the shader
      uCameraHeight: { value: 0 },
      uCameraRotX: { value: 0 },
      uCameraRotY: { value: 0 },
      uCameraRotZ: { value: 0 },
      uZoom: { value: 2 },
      uCameraOffset: { value: new THREE.Vector2(0, 0) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(({ clock, camera, gl }) => {
    const u = materialRef.current?.uniforms;
    if (!u) return;

    u.iTime.value = clock.getElapsedTime();
    u.iResolution.value.set(gl.domElement.width, gl.domElement.height, 1);

    const p = latest.current;
    u.uTimeOfDay.value = timeOfDayRef ? timeOfDayRef.current : p.timeOfDay;
    u.uSeaHeight.value = p.seaHeight;
    u.uSeaChoppy.value = p.seaChoppy;
    u.uSeaFreq.value = p.seaFreq;
    u.uSeaRipples.value = p.seaRipples;
    u.uSeaSpeed.value = p.seaSpeed;
    u.uStarIntensity.value = p.starIntensity;
    u.uSunSize.value = p.sunSize;
    u.uMoonSize.value = p.moonSize;
    u.uSeaBaseColor.value.set(...p.seaBaseColor);
    u.uSeaWaterColor.value.set(...p.seaWaterColor);
    u.uDaySkyColor.value.set(...p.daySkyColor);
    u.uSunsetSkyColor.value.set(...p.sunsetSkyColor);
    u.uNightSkyColor.value.set(...p.nightSkyColor);
    u.uSunColor.value.set(...p.sunColor);
    u.uMoonColor.value.set(...p.moonColor);

    u.uCameraHeight.value = camera.position.y;
    u.uCameraOffset.value.set(camera.position.x, camera.position.z);

    // Derive yaw/pitch directly from the camera's forward vector instead of
    // reading camera.rotation.x/y/z (decomposing a combined pitch+yaw
    // orientation from lookAt() into sequential Euler angles can produce a
    // spurious nonzero component even though the camera itself never rolls).
    //
    // The shader's fromEuler(ang) uses a non-standard axis mapping (verified
    // by expanding its matrix per-axis): ang.x is roll, ang.y is pitch, and
    // ang.z is yaw — NOT the (x=pitch, y=yaw, z=roll) order these uniform
    // names suggest. Mismatching this previously fed pitch into the shader's
    // roll axis, tilting the horizon by an amount proportional to pitch.
    camera.getWorldDirection(worldDir);
    const yaw = Math.atan2(worldDir.x, -worldDir.z);
    const pitch = Math.asin(THREE.MathUtils.clamp(worldDir.y, -1, 1));
    // Roll is different from pitch/yaw above: it isn't derived from the
    // (roll-blind) forward-direction vector, it's read straight back
    // from camera.rotation.z. That's safe here specifically because
    // FlightScene sets that value directly and deliberately (real,
    // intentional mouse-driven roll, order 'YXZ' so it composes as a
    // pure rotation on top of lookAt's pitch+yaw) rather than us trying
    // to decompose it out of an ambiguous orientation — reading back a
    // value that was just explicitly written has none of the
    // decomposition-coupling problems that ang.x's old "always 0"
    // comment above was written to avoid. Without this, the background
    // sky would stay suspiciously level under a foreground that's
    // visibly rolling.
    u.uCameraRotX.value = camera.rotation.z;
    u.uCameraRotY.value = pitch;
    u.uCameraRotZ.value = yaw;

    if (camera instanceof THREE.PerspectiveCamera) {
      u.uZoom.value = 1 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    }
  });

  return (
    <mesh renderOrder={-1000} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={oceanVertexShader}
        fragmentShader={fragmentShader}
        uniforms={initialUniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
