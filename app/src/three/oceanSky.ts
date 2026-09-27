// Raymarched sky + ocean shader — see docs/07-architecture.md#flight-game.
//
// Written from scratch for this project. The techniques are the standard,
// long-published ones for a procedural ocean backdrop — none of the code
// comes from any other shader:
//   - Sea surface: a sum of directional travelling waves with sharpened
//     crests (h = A * exp(c * (sin(phase) - 1))), deep-water dispersion
//     for their speeds, and analytic derivatives for the normals.
//   - Intersection: march the ray through the slab the waves can occupy,
//     then refine the first crossing by bisection.
//   - Shading: Schlick Fresnel between a reflected sky and a tinted water
//     body, a specular sun glint, and distance haze into the horizon.
//   - Sky: a zenith-to-horizon gradient blended by the sun's elevation,
//     a directional dusk glow, sun/moon discs and hashed stars.
//
// This is a FULLSCREEN effect, not real 3D geometry: a 2-triangle quad
// whose fragment shader traces an implicit height-field ocean and a
// procedural sky per pixel. The "camera" that traces through it is
// entirely described by the uniforms below (position via
// uCameraOffset/uCameraHeight, look direction via uCameraRotX/Y/Z +
// uZoom) — OceanSky.tsx keeps those in sync with the scene's real
// Three.js camera every frame, so real 3D objects (the bird, the
// letter-clouds) line up with this painted backdrop.
//
// Camera convention (kept identical to what OceanSky.tsx sends):
// uCameraRotZ is yaw (atan2(fwd.x, -fwd.z)), uCameraRotY is pitch with
// the painted sea MIRRORED (forward.y = -sin(uCameraRotY) — the game's
// framing was tuned on that look; see OceanSky.tsx's truePitchRef), and
// uCameraRotX is roll.

export const oceanVertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

/**
 * The raymarch's cost knobs — steps to find the sea surface per pixel,
 * plus how many waves shape the surface the ray hits (geometry) and
 * how many shade it (normals/lighting). This is a fullscreen fragment shader
 * (see the file-header comment above), so its cost scales with screen
 * pixels, not scene complexity — exactly the kind of shader mobile GPUs
 * struggle with at desktop settings. Reported directly by the user
 * testing on a phone/tablet, not assumed from a benchmark.
 */
export interface OceanQuality {
  numSteps: number;
  iterGeometry: number;
  iterFragment: number;
}

/**
 * The compiled-in loop CEILINGS. The loops actually run to the live
 * uMarchSteps/uIterGeometry/uIterFragment uniforms (see
 * oceanDetailUniforms), so detail can glide up and down at runtime —
 * adaptiveQuality.ts's frame-rate calibration — with no shader
 * recompile, which would itself be a visible hitch.
 */
export const OCEAN_QUALITY_HIGH: OceanQuality = { numSteps: 32, iterGeometry: 3, iterFragment: 5 };
/** The least detail calibration will go to — still recognisably the same sea (the big swells always stay). */
const OCEAN_DETAIL_FLOOR: OceanQuality = { numSteps: 10, iterGeometry: 2, iterFragment: 2.5 };

/** Maps a 0..1 detail level to the shader's live loop budgets. Wave counts are fractional on purpose: the last wave's weight fades rather than popping. */
export function oceanDetailUniforms(detail: number): OceanQuality {
  const lerp = (a: number, b: number) => a + (b - a) * detail;
  return {
    numSteps: lerp(OCEAN_DETAIL_FLOOR.numSteps, OCEAN_QUALITY_HIGH.numSteps),
    iterGeometry: lerp(OCEAN_DETAIL_FLOOR.iterGeometry, OCEAN_QUALITY_HIGH.iterGeometry),
    iterFragment: lerp(OCEAN_DETAIL_FLOOR.iterFragment, OCEAN_QUALITY_HIGH.iterFragment),
  };
}

export function buildOceanFragmentShader(quality: OceanQuality): string {
  return /* glsl */ `
  uniform vec3 iResolution;
  uniform float iTime;

  uniform float uTimeOfDay;
  uniform float uStarIntensity;
  uniform float uSunSize;
  uniform float uMoonSize;

  uniform vec3 uSeaBaseColor;
  uniform vec3 uSeaWaterColor;

  uniform vec3 uDaySkyColor;
  uniform vec3 uSunsetSkyColor;
  uniform vec3 uNightSkyColor;
  uniform vec3 uSunColor;
  uniform vec3 uMoonColor;

  uniform float uSeaHeight;
  uniform float uSeaChoppy;
  uniform float uSeaFreq;
  uniform float uSeaRipples;
  uniform float uSeaSpeed;
  uniform float uCameraSpeed;
  uniform float uCameraHeight;

  uniform float uCameraRotX;
  uniform float uCameraRotY;
  uniform float uCameraRotZ;
  uniform float uZoom;
  uniform vec2 uCameraOffset;
  // The storm round (StormWeather.tsx): uStorm 0 = clear, 1 = full storm,
  // briefly negative as it clears (a warm sunburst); uFlash = lightning.
  uniform float uStorm;
  uniform float uFlash;
  // Live detail budgets, each <= its compiled ceiling above — see oceanDetailUniforms.
  uniform float uMarchSteps;
  uniform float uIterGeometry;
  uniform float uIterFragment;

  // Streak-reward rainbow (see OceanSky.tsx's \`rainbow\` prop). Drawn
  // HERE rather than as a mesh because the ocean's reflections are
  // computed in this shader: anything outside it can't show up in the water.
  // A child's rainbow: six solid bands, red outside to purple inside.
  uniform float uRainbowAlpha;      // 0 = off (whole feature skipped), 1 = fully faded in
  uniform vec3 uRainbowCenter;      // arc centre, world space; the arc faces +z (toward the camera)
  uniform float uRainbowRadius;     // outer (red) edge
  uniform float uRainbowWidth;      // all six bands together
  uniform float uRainbowGlow;       // index of the breathing band, -1 for none
  uniform float uRainbowBreath;     // 0..1, the glow's current swell
  uniform vec3 uRainbowColors[6];   // outermost first, pre-compensated for mainImage's output curve

  const float PI = 3.14159265359;
  // Compiled loop ceilings; the loops stop early at the live uniforms.
  const int MAX_MARCH = ${quality.numSteps};
  const int MAX_GEO_WAVES = ${Math.ceil(quality.iterGeometry * 3)};
  const int MAX_DETAIL_WAVES = ${Math.ceil(quality.iterFragment * 4)};
  const float TAU = 6.28318530718;
  const float FAR = 900.0;

  // ---- hashing (integer avalanche hash, unlike the usual sin-fract) ----
  uint hashU(uint x) {
      x ^= x >> 16; x *= 0x7feb352du;
      x ^= x >> 15; x *= 0x846ca68bu;
      x ^= x >> 16;
      return x;
  }
  float hash3(vec3 p) {
      uvec3 q = uvec3(ivec3(floor(p)) + 32768);
      return float(hashU(q.x ^ hashU(q.y ^ hashU(q.z)))) / 4294967295.0;
  }
  float hash2(vec2 p) { return hash3(vec3(p, 17.0)); }

  // Smooth 2D value noise — only used for the moon's surface markings.
  float valueNoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x),
                 mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
  }

  // ---- sun & moon placement from the clock ----
  // The sun rises on the right (+x), climbs ahead of the flight path
  // (-z) and sets on the left. The moon rises opposite the setting sun,
  // on the right, and by night rides high enough to clear the
  // letter-clouds dead ahead while staying in frame on a portrait phone.
  vec3 sunDirection() {
      float a = (uTimeOfDay - 6.0) / 12.0 * PI;
      return normalize(vec3(cos(a) * 0.9, sin(a) * 0.8, -1.15));
  }
  vec3 moonDirection() {
      float t = uTimeOfDay < 12.0 ? uTimeOfDay + 24.0 : uTimeOfDay;
      float a = (t - 16.0) / 14.0 * PI;
      return normalize(vec3(cos(a) * 0.75 + 0.15, sin(a) * 0.62, -1.1));
  }

  // 0 at night, 1 in full day; and a bump while the sun is near the horizon.
  float daylight(vec3 sun) { return smoothstep(-0.12, 0.3, sun.y); }
  float duskness(vec3 sun) { return 1.0 - smoothstep(0.0, 0.32, abs(sun.y - 0.03)); }

  // ---- sky ----
  vec3 skyGradient(vec3 dir, vec3 sun, float day, float dusk) {
      float up = max(dir.y, 0.0);
      vec3 zenith = mix(uNightSkyColor, uDaySkyColor, day);
      vec3 horizon = mix(uNightSkyColor * 1.8 + vec3(0.02, 0.025, 0.04),
                         mix(uDaySkyColor, vec3(0.92, 0.95, 1.0), 0.6), day);
      // Dusk warms the horizon, strongest on the sun's side of the sky.
      vec2 flatDir = normalize(dir.xz + vec2(1e-5));
      vec2 flatSun = normalize(sun.xz + vec2(1e-5));
      float sunSide = 0.35 + 0.65 * max(dot(flatDir, flatSun), 0.0);
      horizon = mix(horizon, uSunsetSkyColor, dusk * sunSide * 0.85);
      zenith = mix(zenith, mix(uSunsetSkyColor, uNightSkyColor, 0.6), dusk * 0.35);
      return mix(zenith, horizon, pow(1.0 - up, 3.5));
  }

  vec3 skyColor(vec3 dir, bool withDiscs) {
      vec3 sun = sunDirection();
      vec3 moon = moonDirection();
      float day = daylight(sun);
      float dusk = duskness(sun);
      vec3 col = skyGradient(dir, sun, day, dusk);

      // Sun: a wide soft glow plus a bright core, fading out below the horizon.
      float sunUp = smoothstep(-0.08, 0.04, sun.y);
      float cs = max(dot(dir, sun), 0.0);
      vec3 sunTint = mix(uSunColor, uSunsetSkyColor + vec3(0.25, 0.2, 0.1), dusk * 0.6);
      col += sunTint * (pow(cs, 6.0) * 0.18 + pow(cs, 60.0) * 0.35) * sunUp;
      if (withDiscs) {
          float sunDisc = smoothstep(uSunSize * 0.7, uSunSize * 0.3, 1.0 - cs);
          col = mix(col, sunTint * 1.6 + 0.3, sunDisc * sunUp);
      }

      // Moon and stars fade in as the daylight goes.
      float night = 1.0 - day;
      float moonUp = smoothstep(-0.02, 0.06, moon.y) * smoothstep(0.35, 0.05, day);
      float cm = max(dot(dir, moon), 0.0);
      col += uMoonColor * pow(cm, 40.0) * 0.12 * moonUp;
      if (withDiscs && moonUp > 0.0) {
          float moonRadius = uMoonSize * 1.2;
          float ang = acos(clamp(cm, -1.0, 1.0));
          float disc = smoothstep(moonRadius, moonRadius * 0.9, ang);
          if (disc > 0.0) {
              vec3 side = normalize(cross(moon, vec3(0.0, 1.0, 0.0)));
              vec3 upv = cross(side, moon);
              vec2 uv = vec2(dot(dir, side), dot(dir, upv)) / moonRadius;
              float marks = valueNoise(uv * 3.0 + 4.0) * 0.6 + valueNoise(uv * 7.0) * 0.4;
              vec3 face = uMoonColor * (0.8 + 0.35 * marks);
              col = mix(col, face, disc * moonUp);
          }
      }
      if (withDiscs && night > 0.0 && dir.y > 0.0) {
          vec3 cell = dir * 160.0;
          float h = hash3(cell);
          if (h > 0.9965) {
              vec3 f = fract(cell) - 0.5;
              float point = smoothstep(0.35, 0.0, length(f));
              float twinkle = 0.65 + 0.35 * sin(iTime * (1.5 + h * 40.0) + h * 300.0);
              col += vec3(point * twinkle * uStarIntensity * 0.5 * night * smoothstep(0.0, 0.25, dir.y));
          }
      }
      return col;
  }

  // ---- sea surface ----
  // Wave i of the set: direction, wavenumber, amplitude and phase offset.
  // Directions scatter around the wind (toward the camera, +z) by the
  // golden angle so no two waves line up; each wave is a bit shorter and
  // much lower than the last.
  void waveParams(int i, out vec2 d, out float k, out float amp, out float phase0) {
      float fi = float(i);
      float a = 1.05 * sin(fi * 2.39996323) + 0.15;
      d = vec2(sin(a), cos(a));
      k = uSeaFreq * 2.6 * pow(1.21, fi);
      amp = uSeaHeight * 0.7 * pow(0.8, fi);
      phase0 = fi * 1.618 * TAU;
  }

  float crestSharpness() { return 0.45 * uSeaChoppy; }

  // Mean of exp(c * (sin x - 1)) over a period, e^-c * I0(c), so each
  // wave can be centred on y = 0 (the bird skims the mean sea level).
  float crestMean(float c) {
      float c2 = c * c;
      float i0 = 1.0 + c2 / 4.0 + c2 * c2 / 64.0 + c2 * c2 * c2 / 2304.0;
      return exp(-c) * i0;
  }

  float waveTime() { return iTime * uSeaSpeed; }

  // Height only — used by the march, over the (fewer) geometry waves.
  float seaHeight(vec2 xz) {
      float c = crestSharpness();
      float mean = crestMean(c);
      float t = waveTime();
      float h = 0.0;
      for (int i = 0; i < MAX_GEO_WAVES; i++) {
          float w = clamp(uIterGeometry * 3.0 - float(i), 0.0, 1.0);
          if (w <= 0.0) break;
          vec2 d; float k, amp, ph;
          waveParams(i, d, k, amp, ph);
          float phase = k * dot(d, xz) - sqrt(9.8 * k) * 0.45 * t + ph;
          h += w * amp * (exp(c * (sin(phase) - 1.0)) - mean);
      }
      return h;
  }

  // Height, gradient (in .yz) and a crest measure (in .w) over the detail
  // waves. Waves too short to resolve at this distance fade out instead
  // of shimmering.
  vec4 seaDetail(vec2 xz, float footprint) {
      float c = crestSharpness();
      float mean = crestMean(c);
      float t = waveTime();
      float h = 0.0, crest = 0.0;
      vec2 grad = vec2(0.0);
      for (int i = 0; i < MAX_DETAIL_WAVES; i++) {
          float w = clamp(uIterFragment * 4.0 - float(i), 0.0, 1.0);
          if (w <= 0.0) break;
          vec2 d; float k, amp, ph;
          waveParams(i, d, k, amp, ph);
          w *= smoothstep(2.0, 6.0, (TAU / k) / footprint);
          if (w <= 0.0) continue;
          float phase = k * dot(d, xz) - sqrt(9.8 * k) * 0.45 * t + ph;
          float s = exp(c * (sin(phase) - 1.0));
          h += w * amp * (s - mean);
          grad += w * amp * c * cos(phase) * s * k * d;
          crest += w * amp * s;
      }
      if (uSeaRipples > 0.0) {
          // Fine, fast cat's-paw ripples — normals only, never geometry.
          float r = uSeaRipples * 0.06 * smoothstep(0.6, 0.05, footprint);
          vec2 q = xz * 3.1 + vec2(iTime * 0.9, -iTime * 0.7);
          grad += r * vec2(cos(q.x) * cos(q.y * 1.3), -sin(q.x) * sin(q.y * 1.3) * 1.3);
      }
      return vec4(h, grad, crest);
  }

  float slabHalfHeight() {
      // Upper bound on |h| for the geometry waves.
      float total = 0.0;
      for (int i = 0; i < MAX_GEO_WAVES; i++) total += uSeaHeight * 0.7 * pow(0.8, float(i));
      return total + 0.05;
  }

  // Distance along the ray to the sea surface, or -1 for a sky pixel.
  float traceSea(vec3 ori, vec3 dir) {
      float top = slabHalfHeight();
      if (dir.y >= -1e-4 && ori.y > top) return -1.0;
      float tEnter = ori.y > top ? (ori.y - top) / -dir.y : 0.0;
      float tExit = dir.y < -1e-4 ? (ori.y + top) / -dir.y : FAR;
      tExit = min(tExit, FAR);
      if (tEnter >= tExit) return -1.0;

      // Steps bunch up near the camera (quadratic spacing), where the
      // surface covers the most pixels.
      float prevT = tEnter;
      float steps = max(uMarchSteps, 2.0);
      for (int i = 1; i <= MAX_MARCH; i++) {
          if (float(i) > steps) break;
          float f = float(i) / steps;
          float t = mix(tEnter, tExit, f * f);
          vec3 p = ori + dir * t;
          if (p.y < seaHeight(p.xz)) {
              // Bisect between the last point above and this one below.
              float lo = prevT, hi = t;
              for (int j = 0; j < 6; j++) {
                  float mid = 0.5 * (lo + hi);
                  vec3 m = ori + dir * mid;
                  if (m.y < seaHeight(m.xz)) hi = mid; else lo = mid;
              }
              return 0.5 * (lo + hi);
          }
          prevT = t;
      }
      // Never crossed within the budget: the ray grazes the far sea.
      return dir.y < 0.0 ? tExit : -1.0;
  }
  // The rainbow as seen along one ray (direct view, or reflected off the
  // sea): one ray-plane intersection against the arc's vertical plane,
  // cheap enough to run twice per pixel. Deliberately a child's drawing
  // of a rainbow — six solid, clearly separate bands — not the physical
  // phenomenon: an Airy-theory version was built and tried (see
  // docs/10-flight-game.md) and read as strange and washed out in play.
  // Returns premultiplied colour in .rgb, coverage in .a; tHit is the ray
  // distance to the plane, for occlusion against the sea.
  vec4 rainbowSample(vec3 ori, vec3 dir, out float tHit) {
      tHit = 1e9;
      if (uRainbowAlpha <= 0.0 || abs(dir.z) < 1e-4) return vec4(0.0);
      float t = (uRainbowCenter.z - ori.z) / dir.z;
      if (t <= 0.0) return vec4(0.0);
      vec2 d = (ori + dir * t).xy - uRainbowCenter.xy;
      if (d.y < 0.0) return vec4(0.0);
      // 0 at the outer (red) edge, 6 at the inner (purple) edge.
      float band = (uRainbowRadius - length(d)) / uRainbowWidth * 6.0;
      if (band < -2.0 || band > 8.0) return vec4(0.0);
      tHit = t;

      // Screen-space softness for the seams: about one pixel wide at any
      // distance, so the bands stay crisp up close and never alias far off.
      float aa = clamp(fwidth(band) * 0.75, 0.02, 0.3);
      vec3 col = vec3(0.0);
      for (int i = 0; i < 6; i++) {
          float fi = float(i);
          float w = smoothstep(0.5 + aa, 0.5 - aa, abs(band - (fi + 0.5)));
          vec3 c = uRainbowColors[i];
          if (fi == uRainbowGlow) c = mix(c, vec3(1.0), 0.22 * uRainbowBreath);
          col += c * w;
      }
      float edge = smoothstep(-aa, aa, band) * smoothstep(6.0 + aa, 6.0 - aa, band);
      float inGlow = uRainbowGlow >= 0.0 ? smoothstep(0.5 + aa, 0.5 - aa, abs(band - (uRainbowGlow + 0.5))) : 0.0;
      // Nearly opaque, like a crayon rainbow; the other bands ease back
      // a touch as the glowing one swells, so the pulse also reads by contrast.
      float a = mix(0.92 - 0.2 * uRainbowBreath, 1.0, inGlow) * edge;

      // The breathing halo spills past the band onto its neighbours,
      // tinted (not white) so the glowing band still reads as its colour.
      vec3 halo = vec3(0.0);
      if (uRainbowGlow >= 0.0) {
          float g = (band - (uRainbowGlow + 0.5)) / 0.85;
          vec3 gc = uRainbowColors[0];
          for (int i = 0; i < 6; i++) if (float(i) == uRainbowGlow) gc = uRainbowColors[i];
          halo = mix(gc, vec3(1.0), 0.1) * exp(-g * g) * uRainbowBreath * 0.6;
      }
      return vec4((col * a + halo) * uRainbowAlpha, a * uRainbowAlpha);
  }

  // Sky seen along a ray, with the rainbow composited over it when the
  // rainbow's plane is nearer than blockedAt (the sea, for a direct ray).
  vec3 skyWithRainbow(vec3 ori, vec3 dir, bool withDiscs, float blockedAt) {
      vec3 col = skyColor(dir, withDiscs);
      float tR;
      vec4 rb = rainbowSample(ori, dir, tR);
      if (rb.a > 0.0 && tR < blockedAt) col = col * (1.0 - rb.a) + rb.rgb;
      return col;
  }

  vec3 shadeSea(vec3 ori, vec3 dir, vec3 p, float t, float pixelAngle) {
      vec3 sun = sunDirection();
      vec3 moon = moonDirection();
      float day = daylight(sun);

      vec4 sd = seaDetail(p.xz, max(t * pixelAngle, 1e-4));
      vec3 n = normalize(vec3(-sd.y, 1.0, -sd.z));
      vec3 view = -dir;

      // Reflection: the sky (and the rainbow) mirrored in the surface.
      vec3 r = reflect(dir, n);
      r.y = abs(r.y);
      vec3 reflected = skyWithRainbow(p, r, false, 1e9);

      // Water body: deep colour, lifted on the crests where the light
      // passes through the thin water, scaled by how much light there is.
      float light = max(day, 0.12 * smoothstep(-0.02, 0.1, moon.y));
      float crest = clamp(sd.w / max(uSeaHeight * 0.7, 1e-3), 0.0, 1.0);
      float facing = max(dot(n, normalize(sun + vec3(0.0, 0.4, 0.0))), 0.0);
      vec3 body = uSeaBaseColor * (0.35 + 0.65 * light)
                + uSeaWaterColor * 0.05 * pow(crest, 2.0) * (0.4 + 0.6 * facing) * light;

      float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(n, view), 0.0), 5.0);
      vec3 col = mix(body, reflected, clamp(fresnel, 0.0, 0.85));

      // Sun and moon glints.
      float sunUp = smoothstep(-0.05, 0.05, sun.y);
      col += uSunColor * pow(max(dot(r, sun), 0.0), 350.0) * 3.0 * sunUp;
      float moonUp = smoothstep(-0.02, 0.06, moon.y) * (1.0 - day);
      col += uMoonColor * pow(max(dot(r, moon), 0.0), 250.0) * 1.2 * moonUp;

      // Haze into the horizon colour with distance.
      vec3 horizonDir = normalize(vec3(dir.x, 0.0, dir.z));
      float haze = 1.0 - exp(-t * 0.006);
      return mix(col, skyColor(horizonDir, false), haze * haze);
  }

  vec3 renderPixel(vec2 fragCoord) {
      vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;

      // Camera basis from yaw (uCameraRotZ), mirrored pitch (uCameraRotY)
      // and roll (uCameraRotX) — see the header comment.
      float yaw = uCameraRotZ;
      float pitch = -uCameraRotY;
      vec3 fwd = vec3(sin(yaw) * cos(pitch), sin(pitch), -cos(yaw) * cos(pitch));
      vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
      vec3 up = cross(right, fwd);
      float cr = cos(uCameraRotX), sr = sin(uCameraRotX);
      vec3 rightR = cr * right + sr * up;
      vec3 upR = -sr * right + cr * up;
      vec3 dir = normalize(fwd * uZoom + rightR * uv.x + upR * uv.y);

      vec3 ori = vec3(uCameraOffset.x, uCameraHeight, uCameraOffset.y - iTime * uCameraSpeed);
      // Angle one pixel subtends — for the waves' distance fade.
      float pixelAngle = 2.0 / (iResolution.y * uZoom);

      float t = traceSea(ori, dir);
      if (t < 0.0) return skyWithRainbow(ori, dir, true, 1e9);
      vec3 p = ori + dir * t;
      vec3 col = shadeSea(ori, dir, p, t, pixelAngle);
      // The rainbow's feet stand in the sea: drawn over it only where its
      // plane is nearer than the water along this ray.
      float tR;
      vec4 rb = rainbowSample(ori, dir, tR);
      if (rb.a > 0.0 && tR < t) col = col * (1.0 - rb.a) + rb.rgb;
      return col;
  }
  void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
      vec3 color = renderPixel(fragCoord);
      if (uStorm > 0.0) {
          // Storm light: grey, dark and cool — sky and sea alike.
          float lum = dot(color, vec3(0.299, 0.587, 0.114));
          vec3 stormy = vec3(lum) * vec3(0.5, 0.55, 0.62);
          color = mix(color, stormy, uStorm * 0.8);
      } else if (uStorm < 0.0) {
          // The storm clearing: a warm burst of sunlight, then back to normal.
          color = mix(color, color * 1.25 + vec3(0.07, 0.05, 0.0), -uStorm);
      }
      color += vec3(0.8, 0.85, 1.0) * uFlash * 0.45;
      fragColor = vec4(pow(color,vec3(0.65)), 1.0);
  }

  void main() {
      mainImage(gl_FragColor, gl_FragCoord.xy);
  }
`;
}

/** Sensible defaults — a clear-day palette; OceanSky.tsx's day/sunset/night blending comes entirely from uTimeOfDay. */
export const OCEAN_SKY_DEFAULTS: {
  timeOfDay: number;
  starIntensity: number;
  sunSize: number;
  moonSize: number;
  seaBaseColor: [number, number, number];
  seaWaterColor: [number, number, number];
  daySkyColor: [number, number, number];
  sunsetSkyColor: [number, number, number];
  nightSkyColor: [number, number, number];
  sunColor: [number, number, number];
  moonColor: [number, number, number];
  seaHeight: number;
  seaChoppy: number;
  seaFreq: number;
  seaRipples: number;
  seaSpeed: number;
} = {
  timeOfDay: 9,
  starIntensity: 2.0,
  sunSize: 0.005,
  moonSize: 0.05,
  seaBaseColor: [0.0, 0.09, 0.18] as [number, number, number],
  seaWaterColor: [0.0, 1.0, 1.0] as [number, number, number],
  daySkyColor: [0.1, 0.4, 0.8] as [number, number, number],
  sunsetSkyColor: [0.9, 0.45, 0.25] as [number, number, number],
  nightSkyColor: [0.02, 0.03, 0.08] as [number, number, number],
  sunColor: [1.0, 0.9, 0.7] as [number, number, number],
  moonColor: [0.7, 0.75, 0.8] as [number, number, number],
  seaHeight: 0.6,
  seaChoppy: 4.0,
  seaFreq: 0.16,
  seaRipples: 0.1,
  seaSpeed: 0.8,
};

/** Every tunable OceanSky parameter, same shape as OCEAN_SKY_DEFAULTS — used by DevOceanPanel.tsx to live-tune and export a palette. */
export type OceanDevParams = typeof OCEAN_SKY_DEFAULTS;
