// Raymarched sky + ocean shader — see docs/07-architecture.md#flight-game.
//
// Ported and trimmed from "Oceanara" by Julibe (https://codepen.io/Julibe/pen/GgjjpeB),
// whose sea/sky raymarching core is itself the classic "Seascape" shader
// by TDM (Shadertoy: https://www.shadertoy.com/view/Ms2SD1) — a
// widely-taught, freely-adapted reference technique. This port strips
// Oceanara's demo-only scaffolding (the reflective beach ball + its
// physics, the GSAP-tweened sidebar controls, mouse-drag camera) and
// keeps exactly the sky + ocean raymarch, re-exposed as plain uniforms
// for a React Three Fiber component to drive (see OceanSky.tsx).
//
// This is a FULLSCREEN effect, not real 3D geometry: a 2-triangle quad
// whose fragment shader raymarches an implicit height-field ocean and a
// procedural sky per pixel. The "camera" that ray-marches through it is
// entirely described by the uniforms below (position via
// uCameraOffset/uCameraHeight + time*uCameraSpeed, look direction via
// uCameraRotX/Y/Z + uZoom) — OceanSky.tsx keeps those in sync with the
// scene's real Three.js camera every frame, so real 3D objects (the
// bird, the letter-clouds) line up with this painted backdrop.

export const oceanVertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

/**
 * The raymarch's cost knobs — steps to find the sea surface per pixel,
 * plus wave octaves for the coarse (vertex-equivalent) and fine
 * (normal/lighting) height field. This is a fullscreen fragment shader
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
/** The least detail calibration will go to — still recognisably the same sea (the two big swell octaves always stay). */
const OCEAN_DETAIL_FLOOR: OceanQuality = { numSteps: 10, iterGeometry: 2, iterFragment: 2.5 };

/** Maps a 0..1 detail level to the shader's live loop budgets. Octave counts are fractional on purpose: the last octave's weight fades rather than popping. */
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
  // computed in this shader — the same reason Oceanara's beach ball
  // lived in its shader: anything outside it can't show up in the water.
  // A child's rainbow: six solid bands, red outside to purple inside.
  uniform float uRainbowAlpha;      // 0 = off (whole feature skipped), 1 = fully faded in
  uniform vec3 uRainbowCenter;      // arc centre, world space; the arc faces +z (toward the camera)
  uniform float uRainbowRadius;     // outer (red) edge
  uniform float uRainbowWidth;      // all six bands together
  uniform float uRainbowGlow;       // index of the breathing band, -1 for none
  uniform float uRainbowBreath;     // 0..1, the glow's current swell
  uniform vec3 uRainbowColors[6];   // outermost first, pre-compensated for mainImage's output curve

  const int NUM_STEPS = ${quality.numSteps};
  const float PI      = 3.141592;
  const float EPSILON = 1e-3;
  #define EPSILON_NRM (0.1 / iResolution.x)

  const int ITER_GEOMETRY = ${quality.iterGeometry};
  const int ITER_FRAGMENT = ${quality.iterFragment};
  #define SEA_TIME (1.0 + iTime * uSeaSpeed)
  const mat2 octave_m = mat2(1.6,1.2,-1.2,1.6);

  mat3 fromEuler(vec3 ang) {
      vec2 a1 = vec2(sin(ang.x),cos(ang.x));
      vec2 a2 = vec2(sin(ang.y),cos(ang.y));
      vec2 a3 = vec2(sin(ang.z),cos(ang.z));
      mat3 m;
      m[0] = vec3(a1.y*a3.y+a1.x*a2.x*a3.x,a1.y*a2.x*a3.x+a3.y*a1.x,-a2.y*a3.x);
      m[1] = vec3(-a2.y*a1.x,a1.y*a2.y,a2.x);
      m[2] = vec3(a3.y*a1.x*a2.x+a1.y*a3.x,a1.x*a3.x-a1.y*a3.y*a2.x,a2.y*a3.y);
      return m;
  }

  float hash( vec2 p ) {
      float h = dot(p,vec2(127.1,311.7));
      return fract(sin(h)*43758.5453123);
  }

  float noise( in vec2 p ) {
      vec2 i = floor( p );
      vec2 f = fract( p );
      vec2 u = f*f*(3.0-2.0*f);
      return -1.0+2.0*mix( mix( hash( i + vec2(0.0,0.0) ),
                            hash( i + vec2(1.0,0.0) ), u.x),
                      mix( hash( i + vec2(0.0,1.0) ),
                            hash( i + vec2(1.0,1.0) ), u.x), u.y);
  }

  float diffuse(vec3 n,vec3 l,float p) {
      return pow(dot(n,l) * 0.4 + 0.6,p);
  }

  float specular(vec3 n,vec3 l,vec3 e,float s) {
      float nrm = (s + 8.0) / (PI * 8.0);
      return pow(max(dot(reflect(e,n),l),0.0),s) * nrm;
  }

  // levelY is the ray's vertical angle measured with yaw removed (pitch
  // only), so the atmospheric horizon band stays a level, fixed-height
  // gradient on screen instead of tracing a curve whenever the camera
  // yaws (turning the ship). Sun/moon/star placement below still uses
  // the real, fully-rotated e direction so they track true heading.
  vec3 getSkyColor(vec3 e, vec3 lightDir, float levelY) {
      float e_y = max(levelY, 0.0);

      float sun_cycle = sin((uTimeOfDay / 24.0) * PI * 2.0 - PI/2.0);
      float day_blend = clamp(sun_cycle * 2.0, 0.0, 1.0);
      float sunset_blend = clamp(1.0 - abs(sun_cycle * 3.0), 0.0, 1.0);

      vec3 horizon_color = mix(vec3(1.0, 1.0, 1.0), uDaySkyColor, 0.3);
      vec3 day_sky = mix(horizon_color, uDaySkyColor, e_y) * 1.1;

      vec3 night_sky = uNightSkyColor - e_y * 0.02;
      vec3 sunset_sky = uSunsetSkyColor * (1.0 - e_y);

      vec3 sky = mix(night_sky, day_sky, day_blend);
      sky = mix(sky, sunset_sky, sunset_blend * max(0.0, 1.0 - e_y * 2.0));

      float theta = (uTimeOfDay / 24.0) * PI * 2.0;
      float cos_t = cos(theta);
      float sin_t = sin(theta);
      mat2 rot_matrix = mat2(cos_t, -sin_t, sin_t, cos_t);

      vec3 star_e = e;
      star_e.xy = rot_matrix * star_e.xy;

      float star_noise = hash(star_e.xy * 300.0 + star_e.z * 300.0);
      float stars = pow(clamp(star_noise - 0.998, 0.0, 1.0) * 500.0, 2.0);
      stars *= (0.5 + 0.5 * sin(iTime * 2.0 + star_noise * 100.0));
      sky += vec3(stars) * uStarIntensity * max(0.0, 1.0 - day_blend - sunset_blend * 0.5);

      float sun_dot = clamp(dot(e, lightDir), 0.0, 1.0);
      float sun_disk = smoothstep(1.0 - uSunSize, 1.0 - uSunSize + 0.002, sun_dot);
      float sun_glow = pow(sun_dot, 25.0);
      sky += uSunColor * sun_disk * 2.0 * max(0.0, day_blend);
      sky += vec3(1.0, 0.6, 0.2) * sun_glow * sunset_blend * 1.5;
      sky += vec3(1.0, 0.8, 0.5) * pow(sun_dot, 50.0) * 0.8 * max(0.0, day_blend);

      // Same general direction as the sun (lightDir), not diametrically
      // opposite it: the camera in this game always faces roughly
      // toward wherever the sun sits (that's the whole "flying into the
      // sunset" framing), so a moon placed opposite the sun sits
      // directly behind the camera all game — mathematically present,
      // never actually seen. Placing it near the sun's own direction
      // (elevated a bit higher) is what makes it read as "the moon
      // replaces the sun" instead of "the moon exists somewhere I'm
      // not looking."
      // Elevation lowered (was -ly*0.3+0.55, ~40-60deg up): the chase
      // cam's 60deg vertical FOV only ever caught the moon's halo in a
      // top corner, never the disc itself — checked in night captures.
      vec3 moon_dir = normalize(vec3(lightDir.x, -lightDir.y * 0.15 + 0.34, lightDir.z));
      float b = dot(e, moon_dir);
      float c = 1.0 - (uMoonSize * uMoonSize);
      float d = b * b - c;

      if (d > 0.0 && b > 0.0) {
          float t = b - sqrt(d);
          vec3 p = e * t;
          vec3 n = normalize(p - moon_dir);

          float nse = noise(n.xy * 15.0) * 0.5 + 0.5;
          nse *= noise(n.yz * 30.0) * 0.5 + 0.5;

          // A storybook full moon lit from the viewer's side (limb
          // darkening from the sphere normal vs. the view ray), not a
          // fixed side-light: the original half-lit shading put a pure
          // black unlit hemisphere against the dusk sky, which read as a
          // black hole punched into the orange (seen in real captures at
          // t~6.5 and t~19-20, not theorized).
          float dif = max(dot(n, -e), 0.0);
          vec3 moon_base_col = uMoonColor * (0.35 + 0.65 * dif) * (0.7 + 0.3 * nse) * 1.15;
          // Only the disc blends in (soft limb), the halo below stays
          // additive; cubic falloff on day_blend means it's gone by
          // mid-morning instead of lingering as a ~40% grey ghost, and
          // the sunset term keeps it out of the orange band.
          float moon_night = max(0.0, 1.0 - day_blend);
          float moon_vis = moon_night * moon_night * moon_night * (1.0 - sunset_blend * 0.85);
          float limb = smoothstep(0.0, 0.18, dif);
          sky = mix(sky, moon_base_col, moon_vis * limb);
      } else {
          float moon_dot = clamp(dot(e, moon_dir), 0.0, 1.0);
          float moon_glow = pow(moon_dot, 80.0);
          sky += vec3(0.3, 0.4, 0.6) * moon_glow * 0.8 * max(0.0, 1.0 - day_blend) * (1.0 - sunset_blend * 0.85);
      }

      return sky;
  }

  vec3 getSkyColor(vec3 e, vec3 lightDir) {
      return getSkyColor(e, lightDir, e.y);
  }

  float sea_octave(vec2 uv, float choppy) {
      uv += noise(uv);
      vec2 wv = 1.0-abs(sin(uv));
      vec2 swv = abs(cos(uv));
      wv = mix(wv,swv,wv);
      return pow(1.0-pow(wv.x * wv.y,0.65),choppy);
  }

  float map(vec3 p) {
      float freq = uSeaFreq;
      float amp = uSeaHeight;
      float choppy = uSeaChoppy;
      vec2 uv = p.xz; uv.x *= 0.75;

      float d, h = 0.0;
      for(int i = 0; i < ITER_GEOMETRY; i++) {
          float w = clamp(uIterGeometry - float(i), 0.0, 1.0);
          if (w <= 0.0) break;
          d = sea_octave((uv+SEA_TIME)*freq,choppy);
          d += sea_octave((uv-SEA_TIME)*freq,choppy);
          h += d * amp * w;
          uv *= octave_m; freq *= 1.9; amp *= 0.22;
          choppy = mix(choppy,1.0,0.2);
      }
      return p.y - h;
  }

  float map_detailed(vec3 p) {
      float freq = uSeaFreq;
      float amp = uSeaHeight;
      float choppy = uSeaChoppy;
      vec2 uv = p.xz; uv.x *= 0.75;

      float d, h = 0.0;
      for(int i = 0; i < ITER_FRAGMENT; i++) {
          float w = clamp(uIterFragment - float(i), 0.0, 1.0);
          if (w <= 0.0) break;
          d = sea_octave((uv+SEA_TIME)*freq,choppy);
          d += sea_octave((uv-SEA_TIME)*freq,choppy);
          h += d * amp * w;
          uv *= octave_m; freq *= 1.9; amp *= 0.22;
          choppy = mix(choppy,1.0,0.2);
      }

      if (uSeaRipples > 0.0) {
          h += sin(uv.x * 25.0 + iTime * 4.0) * cos(uv.y * 25.0 + iTime * 4.0) * (uSeaRipples * 0.005);
      }

      return p.y - h;
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

  vec3 getSeaColor(vec3 p, vec3 n, vec3 l, vec3 eye, vec3 dist) {
      float fresnel = clamp(1.0 - dot(n, -eye), 0.0, 1.0);
      fresnel = min(fresnel * fresnel * fresnel, 0.5);

      vec3 reflected_dir = reflect(eye, n);
      vec3 reflected = getSkyColor(reflected_dir, l);
      // Reflected off the real wave normal, so the rainbow's image in the
      // water breaks up and shimmers with the swell rather than being a
      // flat mirrored copy.
      float tReflRainbow;
      vec4 reflRainbow = rainbowSample(p, reflected_dir, tReflRainbow);
      reflected = reflected * (1.0 - reflRainbow.a) + reflRainbow.rgb;

      float sun_cycle = sin((uTimeOfDay / 24.0) * PI * 2.0 - PI/2.0);
      float day_blend = clamp(sun_cycle * 2.0 + 0.2, 0.0, 1.0);

      vec3 current_base = mix(vec3(0.0, 0.01, 0.04), uSeaBaseColor, day_blend);
      vec3 current_water = mix(vec3(0.1, 0.15, 0.2), uSeaWaterColor, day_blend);

      vec3 refracted = current_base + diffuse(n, l, 80.0) * current_water * 0.12;

      vec3 color = mix(refracted, reflected, fresnel);
      // Fresnel alone (capped at 0.5 above) leaves a far-off object's
      // reflection as scattered glints; a little extra on top lets the
      // rainbow's mirror image read as a shape in the water, like the
      // original demo's ball did.
      color += reflRainbow.rgb * 0.35;

      float atten = max(1.0 - dot(dist, dist) * 0.001, 0.0);
      color += current_water * (p.y - uSeaHeight) * 0.18 * atten;

      color += specular(n, l, eye, 600.0 * inversesqrt(dot(dist,dist)));

      return color;
  }

  vec3 getNormal(vec3 p, float eps) {
      vec3 n;
      n.y = map_detailed(p);
      n.x = map_detailed(vec3(p.x+eps,p.y,p.z)) - n.y;
      n.z = map_detailed(vec3(p.x,p.y,p.z+eps)) - n.y;
      n.y = eps;
      return normalize(n);
  }

  float heightMapTracing(vec3 ori, vec3 dir, out vec3 p) {
      float tm = 0.0;
      float tx = 1000.0;
      float hx = map(ori + dir * tx);
      if(hx > 0.0) {
          p = ori + dir * tx;
          return tx;
      }
      float hm = map(ori);
      for(int i = 0; i < NUM_STEPS; i++) {
          if (float(i) >= uMarchSteps) break;
          float tmid = mix(tm, tx, hm / (hm - hx));
          p = ori + dir * tmid;
          float hmid = map(p);
          if(hmid < 0.0) {
              tx = tmid;
              hx = hmid;
          } else {
              tm = tmid;
              hm = hmid;
          }
          if(abs(hmid) < EPSILON) break;
      }
      return mix(tm, tx, hm / (hm - hx));
  }

  vec3 getPixel(in vec2 coord, float time) {
      vec2 uv = coord / iResolution.xy;
      uv = uv * 2.0 - 1.0;
      uv.x *= iResolution.x / iResolution.y;

      vec3 ang = vec3(uCameraRotX, uCameraRotY, uCameraRotZ);
      vec3 ori = vec3(uCameraOffset.x, uCameraHeight, time * uCameraSpeed + uCameraOffset.y);

      // The original Seascape/Oceanara shader added length(uv) * 0.14
      // to dir.z here — a fisheye-style warp that pulls the ray toward
      // the viewer more the farther a pixel is from screen center. It's
      // radially symmetric, so on its own it reads as a barrel/dome
      // curve; combined with this scene's camera looking slightly
      // downward (chasing the bird from above-behind) the effect's
      // center doesn't line up with the frame's visual center, which is
      // what actually read as "the horizon is tilted" — not a camera
      // rotation bug at all (removing/reducing every rotation term
      // changed nothing, which is what pointed here instead). Dropped
      // for a standard, undistorted perspective ray.
      vec3 dir = normalize(vec3(uv.xy, -uZoom));
      dir = normalize(dir) * fromEuler(ang);

      // Pitch-only version of the same ray, for the horizon's vertical
      // position on screen — see getSkyColor's levelY comment above.
      // fromEuler's axis order is (roll, pitch, yaw): keep roll (ang.x,
      // always 0) and pitch (ang.y), drop yaw (ang.z) to zero.
      vec3 dirLevel = normalize(vec3(uv.xy, -uZoom));
      dirLevel = normalize(dirLevel) * fromEuler(vec3(ang.x, ang.y, 0.0));

      vec3 p;
      float tSea = heightMapTracing(ori,dir,p);
      vec3 dist = p - ori;

      float theta = (uTimeOfDay / 24.0) * PI * 2.0 - PI/2.0;
      vec3 light = normalize(vec3(cos(theta) * 1.5, sin(theta) * 1.2, -1.5));

      float eps = max(0.005, dot(dist, dist) * EPSILON_NRM);
      vec3 n = getNormal(p, eps);
      vec3 sea_color = getSeaColor(p, n, light, dir, dist);

      vec3 base_color = mix(
          getSkyColor(dir, light, dirLevel.y),
          sea_color,
          pow(smoothstep(0.0,-0.02,dirLevel.y),0.2)
      );

      // Only where the rainbow's plane is nearer than the sea along this
      // ray — the arc's feet sit just under the waterline, so the swell
      // in front of them occludes them the way it would a real object.
      float tRainbow;
      vec4 rainbow = rainbowSample(ori, dir, tRainbow);
      if (tRainbow < tSea) base_color = base_color * (1.0 - rainbow.a) + rainbow.rgb;

      return base_color;
  }

  void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
      float time = iTime;
      vec3 color = getPixel(fragCoord, time);
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

/** Sensible defaults, close to Oceanara's own — a clear-day palette; OceanSky.tsx's day/sunset/night blending comes entirely from uTimeOfDay. */
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
