import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { oceanVertexShader, buildOceanFragmentShader, oceanDetailUniforms, OCEAN_SKY_DEFAULTS, OCEAN_QUALITY_HIGH, type OceanQuality } from './oceanSky';
import { oceanDetailFromQuality, oceanScaleFromQuality } from './adaptiveQuality';
import { RAINBOW_COLORS } from '../engine/rainbowChoice';

/** The streak-reward rainbow, drawn inside the ocean shader so it reflects in the water — see oceanSky.ts's rainbowSample. */
export interface OceanRainbow {
  /** Band (index into RAINBOW_COLORS) that breathes. */
  glowIndex: number;
  /** Once answered, the glow holds at full instead of breathing. */
  solved: boolean;
  /** Arc centre in world space — FlightScene snapshots it once per round. */
  center: [number, number, number];
  /** Outer (red) edge radius and the six bands' combined width, world units. */
  radius: number;
  width: number;
}

const RAINBOW_FADE_SECONDS = 0.8;
// One full breath (dim → bright → dim). Slow on purpose: a pulse a
// 4-year-old can follow, not a flash.
const RAINBOW_BREATH_SECONDS = 1.8;
// mainImage ends with pow(color, 0.65); feeding the hex colours through
// the inverse curve is what makes them come out on screen as picked
// (and matching the answer swatches), not washed out.
const RAINBOW_UNIFORM_COLORS = RAINBOW_COLORS.map((c) => {
  const col = new THREE.Color(c.hex);
  return new THREE.Vector3(col.r ** (1 / 0.65), col.g ** (1 / 0.65), col.b ** (1 / 0.65));
});

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
  /** Compiled loop CEILINGS (see oceanSky.ts's OCEAN_QUALITY_HIGH) — read once at mount. The detail actually rendered is `qualityRef`'s, live. */
  quality?: OceanQuality;
  /** Live 0..1 frame-rate calibration level — see adaptiveQuality.ts. Absent = full detail (e.g. a standalone preview). */
  qualityRef?: React.RefObject<number>;
  /**
   * 0..1 — how much of the TRUE camera pitch to hand the shader. The
   * shader applies pitch with the opposite sign to three.js (for the
   * forward ray, y = -sin(pitch) — see oceanSky.ts's header), so the
   * painted horizon is mirrored: a camera tilted down draws the sea
   * tilted up. The whole game's framing was tuned on that look, so it's
   * left as-is by default (0); the rainbow skim's drone shot blends to 1,
   * where the bird must visibly sit ON the painted sea.
   */
  truePitchRef?: React.RefObject<number>;
  rainbow?: OceanRainbow | null;
  /** Storm-round weather: level (0 clear … 1 storm, dips negative as it clears) and lightning flash — see StormWeather.tsx. */
  stormRef?: React.RefObject<number>;
  flashRef?: React.RefObject<number>;
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
 * backdrop and the real 3D objects would drift apart. Orientation is
 * passed as yaw/pitch derived from the camera's forward vector plus its
 * explicit roll — see the useFrame below and oceanSky.ts's header for
 * the exact convention the shader builds its camera basis from.
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
  rainbow = null,
  qualityRef,
  truePitchRef,
  stormRef,
  flashRef,
}: OceanSkyProps) {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const displayRef = useRef<THREE.Mesh>(null);
  // Built once per mount, keyed off `quality` — swapping it later would
  // need `material.needsUpdate = true` to force a shader recompile,
  // which nothing here does (device tier is decided once, at spawn).
  const fragmentShader = useMemo(() => buildOceanFragmentShader(quality), [quality]);
  const worldDir = useRef(new THREE.Vector3()).current;
  // Eased toward the calibrator's target, so even its discrete steps
  // reach the sea as a slow drift, never a visible pop.
  const appliedDetail = useRef<number | null>(null);
  // Keeps the last rainbow around after the prop goes null, so it can
  // fade out where it was instead of blinking off.
  const rainbowRef = useRef<{ current: OceanRainbow | null; last: OceanRainbow | null; alpha: number; age: number }>({ current: null, last: null, alpha: 0, age: 0 });
  rainbowRef.current.current = rainbow;
  if (rainbow) rainbowRef.current.last = rainbow;

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
      uMarchSteps: { value: quality.numSteps },
      uIterGeometry: { value: quality.iterGeometry },
      uIterFragment: { value: quality.iterFragment },
      uStorm: { value: 0 },
      uFlash: { value: 0 },
      uRainbowAlpha: { value: 0 },
      uRainbowCenter: { value: new THREE.Vector3() },
      uRainbowRadius: { value: 1 },
      uRainbowWidth: { value: 1 },
      uRainbowGlow: { value: -1 },
      uRainbowBreath: { value: 0 },
      uRainbowColors: { value: RAINBOW_UNIFORM_COLORS },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Built here rather than as JSX so the same material can draw either
  // straight to the screen or into the sea's own render target.
  const oceanMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: oceanVertexShader,
        fragmentShader,
        uniforms: initialUniforms,
        depthTest: false,
        depthWrite: false,
      }),
    [fragmentShader, initialUniforms],
  );
  materialRef.current = oceanMaterial;

  // The sea at its own resolution (see adaptiveQuality.ts's
  // oceanScaleFromQuality): rendered into this target, then copied to the
  // screen by a plain textured quad, bilinear-filtered. Neither shader
  // does any colour-space conversion, so the copy is exact. At scale 1
  // none of this runs — the sea draws straight to the screen as before.
  const offscreen = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    const scene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), oceanMaterial);
    quad.frustumCulled = false;
    scene.add(quad);
    const copyMaterial = new THREE.ShaderMaterial({
      uniforms: { tSea: { value: target.texture } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tSea; varying vec2 vUv; void main() { gl_FragColor = texture2D(tSea, vUv); }',
      depthTest: false,
      depthWrite: false,
    });
    // The vertex shaders ignore the camera entirely; any camera will do.
    return { target, scene, quad, copyMaterial, camera: new THREE.OrthographicCamera() };
  }, [oceanMaterial]);
  useEffect(
    () => () => {
      offscreen.target.dispose();
      offscreen.quad.geometry.dispose();
      offscreen.copyMaterial.dispose();
      oceanMaterial.dispose();
    },
    [offscreen, oceanMaterial],
  );

  useFrame(({ clock, camera, gl }, delta) => {
    const u = materialRef.current?.uniforms;
    if (!u) return;

    const targetDetail = oceanDetailFromQuality(qualityRef?.current ?? 1);
    appliedDetail.current = appliedDetail.current === null ? targetDetail : appliedDetail.current + (targetDetail - appliedDetail.current) * (1 - Math.exp(-2 * delta));
    const detail = oceanDetailUniforms(appliedDetail.current);
    // Never above what was compiled in — the loops' constant bounds.
    u.uMarchSteps.value = Math.min(detail.numSteps, quality.numSteps);
    u.uIterGeometry.value = Math.min(detail.iterGeometry, quality.iterGeometry);
    u.uIterFragment.value = Math.min(detail.iterFragment, quality.iterFragment);

    u.uStorm.value = stormRef?.current ?? 0;
    u.uFlash.value = flashRef?.current ?? 0;

    const rb = rainbowRef.current;
    if (rb.current && rb.alpha === 0) rb.age = 0;
    rb.alpha = THREE.MathUtils.clamp(rb.alpha + (rb.current ? 1 : -1) * (delta / RAINBOW_FADE_SECONDS), 0, 1);
    rb.age += delta;
    u.uRainbowAlpha.value = rb.alpha;
    if (rb.last) {
      // Portrait phones see a much narrower slice of the horizon — shrink
      // the arc so both feet (and their reflections) stay on screen. The
      // band width shrinks more gently so the bands stay tappable-looking
      // fat rather than thinning to threads.
      const aspect = camera instanceof THREE.PerspectiveCamera ? camera.aspect : 1.5;
      const fit = THREE.MathUtils.clamp(aspect / 0.75, 0.7, 1);
      u.uRainbowRadius.value = rb.last.radius * fit;
      u.uRainbowWidth.value = rb.last.width * Math.sqrt(fit);
      u.uRainbowCenter.value.set(...rb.last.center);
      u.uRainbowGlow.value = rb.last.glowIndex;
      // Cosine-eased 0..1..0 so it swells and settles rather than ticking.
      u.uRainbowBreath.value = rb.last.solved ? 1 : 0.5 - 0.5 * Math.cos((rb.age / RAINBOW_BREATH_SECONDS) * Math.PI * 2);
    }

    u.iTime.value = clock.getElapsedTime();

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
    // Axis mapping the shader expects (see oceanSky.ts's header):
    // uCameraRotX is roll, uCameraRotY is pitch and uCameraRotZ is yaw —
    // NOT the (x=pitch, y=yaw, z=roll) order these uniform names suggest.
    // The names are kept so the dev panel and older docs still line up.
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
    u.uCameraRotY.value = pitch * (1 - 2 * (truePitchRef?.current ?? 0));
    u.uCameraRotZ.value = yaw;

    if (camera instanceof THREE.PerspectiveCamera) {
      u.uZoom.value = 1 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    }

    const width = gl.domElement.width;
    const height = gl.domElement.height;
    const scale = qualityRef ? oceanScaleFromQuality(qualityRef.current ?? 1, gl.getPixelRatio()) : 1;
    const display = displayRef.current;
    if (scale === 1) {
      u.iResolution.value.set(width, height, 1);
      if (display) display.material = oceanMaterial;
      return;
    }
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    if (offscreen.target.width !== w || offscreen.target.height !== h) offscreen.target.setSize(w, h);
    u.iResolution.value.set(w, h, 1);
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(offscreen.target);
    gl.render(offscreen.scene, offscreen.camera);
    gl.setRenderTarget(previous);
    if (display) display.material = offscreen.copyMaterial;
  });

  return (
    <mesh ref={displayRef} renderOrder={-1000} frustumCulled={false} material={oceanMaterial}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
