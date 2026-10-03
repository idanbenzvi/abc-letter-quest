# Flight game — replacing the core gameplay

Per direct user instruction, this **replaces** the World Map + Letter
Learning (reveal/trace/quiz) flow as the core play experience — not an
add-on mode. [09-roadmap.md](./09-roadmap.md) tracks phase status;
[06-data-model.md](./06-data-model.md)'s `LetterProgress`/scheduler
math is reused, not replaced (see "What's reused" below). Onboarding
and the parent Dashboard are not "gameplay" and are assumed to stay,
pending confirmation.

## Concept

An albatross flies home across the sea to its nest, carrying the
letters it collects along the way to its chicks. The camera moves
continuously forward (on-rails, not free-roam) over an ocean, through
a sky that arcs from dawn through noon, sunset, and into real night by
the time the mission ends — the actual mission timer, made diegetic
instead of a bare countdown; mission length (and so the length of that
whole arc) is parent-configurable from the Dashboard (2/4/6/8 minutes
— `Settings.missionDurationSeconds`, `state/AppContext.tsx`). The
flight path itself isn't a straight rail either — a slow per-mission
lateral weave (`FlightScene.tsx`'s `routeSeed`) means the path never
traces the same curve twice. That weave blends onto the upcoming
cloud's actual lane (`enc.laneX`) the closer the bird gets to it
(`STEER_RANGE` in the same file) — the cloud itself never moves, it's
fixed at spawn, so without steering the free weave could carry the
bird well past its lane and the letter would look like it was sliding
around rather than being flown toward. Both the bird and the camera
share this steered X, so the letter visibly settles into view as a
stationary target being approached, not a moving one.

Letter-shaped clouds appear ahead in sequence, resolvable three ways —
whichever the child reaches for first, all equally valid:

1. **Tap the cloud** → hear its name spoken → self-report whether they
   knew it (right arrow) or not (left arrow) — see "Interaction loop"
   below. The original, still-primary path.
2. **Type the letter** on a physical keyboard — an unambiguous
   demonstration of knowledge, so it skips the self-report question
   entirely and pays a bigger bonus.
3. **Pick the matching picture** — three small illustrated "bubble
   clouds" appear alongside the letter cloud while it's still
   unanswered, one of them a word starting with that letter; tapping
   the right one pays the same bonus as typing. Only offered when the
   target letter has a real illustrated word (today: A-F — see
   `engine/pictureChoice.ts` and docs/08-asset-pipeline.md's icon
   coverage gap); a wrong pick just shakes gently and costs nothing,
   consistent with the no-frustration stance throughout.

Both bonus paths end the same way: the cloud pops into a burst of
soap-bubble sprites (swapped texture + outward drift, `LetterCloud`'s
`burst` mode) instead of the plain fade used when the bird simply
flies past an unanswered cloud.

The view also has a small, deliberately subtle mouse-look parallax —
moving the mouse eases the camera's gaze (and the albatross's own
pitch/yaw) a little to one side, heavily damped so it drifts rather
than tracks the cursor. It's intentionally clamped well inside the
range the ocean/sky shader renders correctly — see "Five real bugs"
below, this feature is the fifth.

## Two proven building blocks

Both verified working (visually, via screenshots, not just "should
work") before any of the rest of this doc was written:

### 1. Letter-shaped clouds — `three/cloudLetter.ts` + `three/LetterCloud.tsx`

Technique adapted (MIT) from
[uuuulala/WebGL-typing-tutorial](https://github.com/uuuulala/WebGL-typing-tutorial)
(the source behind the tympanus.net demo the user linked): render the
glyph to an offscreen 2D canvas, sample which pixels are "inside" it,
place one soft billboard puff sprite per sampled point via a single
`InstancedMesh`. **Not** a volumetric/raymarched cloud — a sprite
trick — which is exactly why it stays cheap on a tablet: one draw call
per letter. Confirmed working on both uppercase and lowercase,
including glyphs with interior holes (tested "g"). Beyond the original
"breathing" scale pulse, each puff also drifts slightly in x/y/z (own
sine frequency/phase per puff, deliberately different from the breathe
pulse's so nothing moves in lockstep) — small relative to the 4px
sampling grid, so the glyph stays legible while the cloud's edges
visibly churn instead of sitting static (confirmed via two screenshots
2.5s apart: same letter, visibly softer/fuzzier silhouette).

**Hover-to-swap-case + real morph.** Hovering a mouse over a still-
`pending` cloud for 2s (`FlightScene.tsx`'s `EncounterCloud`, a plain
`setTimeout` on `onPointerOver`/cleared on `onPointerOut`) flips
`encounter.displayChar` between upper/lower case, letting a curious
child see both forms without committing to an answer. The first cut of
the visual for this swapped the point set outright and covered the cut
with a squash-pulse flourish; the user asked for an actual morph
instead of "the cloud just disappearing in mid air", which the pulse
still effectively was. Rebuilt properly: `LetterCloud` now allocates a
**fixed** `MAX_INSTANCES` (1400 — 'W' is the worst case across the
whole alphabet at ~1190 puffs, measured directly rather than guessed)
instead of sizing the `InstancedMesh` to the current letter's exact
point count, because that's what forced a destroy-and-recreate (the
"poof") on every letter change. With a fixed instance count, a letter
change instead keeps the OLD point set (`fromRef`) and blends every
puff toward the NEW set (`toRef`) over 0.5s: a puff present in both
shapes glides from its old position to its new one; a puff only the
old shape had shrinks away in place; a puff only the new shape needs
grows in at its target position. There's no real 1:1 correspondence
between "puff i in 'D'" and "puff i in 'd'" (independent pixel samples
of two different glyphs) — doesn't matter for a fuzzy cloud shape, the
aggregate motion still reads as one shape fluidly reforming into the
other. Verified via a paced screenshot sequence (spaced `waitForTimeout`
calls, not a rapid-fire burst — an unrelated red herring first: a burst
of 8 back-to-back screenshots made the bird appear to teleport through
the cloud, which turned out to be each WebGL readback's own real cost
in this environment eating into the intended wait budget, not a bug in
the morph itself).

### 2. Sky + ocean — `three/oceanSky.ts` + `three/OceanSky.tsx`

Written from scratch for this project (Sep 2026). The first version
was a port of a CodePen demo whose core was the "Seascape" Shadertoy
shader, licensed CC BY-NC-SA 3.0. That license forbids commercial use
and requires derivatives to carry the same license, which conflicts
with this project's proprietary license, so the shader was replaced
with an independent implementation. Nothing from the old shader's wave,
tracing or shading code was carried over; only this project's own
additions (the rainbow, the storm/flash grading) and the uniform
interface survive. The history sections below still mention the old
shader's `fromEuler()`: they describe bugs in that earlier version.

This is a **fullscreen fragment shader**, not real 3D geometry: a
2-triangle quad traces an implicit height-field ocean and a procedural
sky (day/sunset/night blend, sun, moon, stars) per pixel, driven
entirely by uniforms:

- **Waves:** 20 directional travelling waves with sharpened crests
  (`A * exp(c * (sin(phase) - 1))`). Long swells come from near the wind
  direction and shorter chop spreads wider, scattered by the golden
  angle. Speeds follow deep-water dispersion, and normals use analytic
  derivatives. The first 9 waves shape the surface the ray hits; all 20
  shade it. Waves too short to resolve at a pixel's distance are skipped.
- **Wave table baked as code:** `buildWaveTable` emits one straight-line
  block per wave with its numbers inlined. A `const` array indexed by
  the loop counter measured *slower* than recomputing every parameter,
  because ANGLE's translator can copy the whole array on each dynamic
  index.
- **Intersection:** a short coarse march (16 steps at full quality,
  evenly spaced for steep rays, bunched near the camera for grazing
  ones) only brackets the first crossing; 4 Illinois false-position
  steps then refine it. 8 and 32 steps render identically.
- **Shading:** Schlick Fresnel between the reflected sky and the water
  body; turquoise light scattered through the thin tops of waves
  (strongest looking toward the sun); a Gaussian-slope sun/moon glint
  whose roughness includes the detail too fine to draw, so the distant
  sea turns into a shimmering sun road; foam flecks on the sharpest
  nearby crests; distance haze.
- **Sky:** zenith-to-horizon gradient blended by sun elevation, a
  directional dusk glow, sun and moon discs, hashed twinkling stars. The
  sun rises right, sets left; the moon rises opposite the setting sun.
- **Cost:** in a standalone benchmark (640x360, SwiftShader, full
  quality) the frame takes about 54 ms, against 71 ms for the old
  shader.

**Camera sync architecture** (the actual integration challenge, since
a fullscreen shader has no real 3D camera of its own): `OceanSky`
reads the scene's **real** Three.js camera every frame and feeds its
live position/rotation/fov in as the shader's uniforms, rather than
letting the shader drive an independent implicit camera as the original
demo did. The real camera is the single source of truth — real 3D
objects (bird, letter-clouds) and the painted backdrop are guaranteed
to agree on where "here" is because they're reading the same camera.
The shader builds its camera basis from yaw, pitch and roll uniforms
(convention in `oceanSky.ts`'s header).

**The dev tuning panel's camera — restored the demo's mouse-drag orbit
and scroll-zoom.** `DevOceanPanel.tsx`'s sliders alone weren't a
substitute for the original CodePen's free-look — the user asked for
the demo's actual camera controls back, not just its parameter UI.
Since "the real camera is the single source of truth" above, this
didn't need any shader-side work: `FlightScene.tsx` just stops driving
`camera.position`/`lookAt` imperatively while the panel is open and
mounts `@react-three/drei`'s `<OrbitControls>` instead (seeded from
wherever the automatic flight-cam last pointed, so opening the panel
doesn't yank the view somewhere unrelated); `OceanSky` keeps reading
whatever the "real" camera is doing regardless of who's driving it, so
no changes needed there. Confirmed via a real drag+scroll test, not
just by reading the code — closing the panel again hands control back
to the automatic camera cleanly (a visual snap back to the flight path
is expected and fine; this is a dev tool, not player-facing).

`uTimeOfDay` (0-24) drives the whole day/sunset/night look — this is
the direct implementation of "advance the time of day slowly." It's a
plain prop on `<OceanSky>`; the flight scene will lerp it across the
configured mission duration.

## Six real bugs found by testing, not by reasoning

All six are documented in code comments at the point they were fixed —
noted here too because they're exactly the kind of mistake worth not
repeating. The pattern across all six: something *looked* correct on
inspection and only broke visibly under an actual multi-step playthrough
— none of these would have been caught by types or a quick glance.

1. **`useFrame`'s closure went stale** — a callback registered once
   kept seeing the render that created it, not later ones, even though
   React re-rendered with new props. Fixed with a "latest value" ref
   pattern (read `ref.current` inside `useFrame`, updated fresh every
   render) rather than trusting the closure — the robust fix regardless
   of exact root cause (plausibly related to the React 19.3 /
   `@react-three/fiber@9.7` peer-version mismatch this project
   currently papers over with `--legacy-peer-deps` — see `package.json`).
2. **R3F's `uniforms` prop on `<shaderMaterial>` clones, not
   references** — mutating the object passed in as `uniforms` (even a
   stable `useMemo` reference) silently updates an orphaned copy the
   material never reads again; confirmed via
   `materialRef.current.uniforms !== theObjectWePassedIn` returning
   `true`. Fix: write through `materialRef.current.uniforms.<name>.value`
   directly inside `useFrame`; the JSX `uniforms` prop only seeds
   initial values at mount. This is the correct general pattern for any
   future shader work in this app, not specific to the ocean.
3. **Missing `key` on the sequentially-spawned cloud, once sequential
   spawning replaced "place all 6 up front"** — `<EncounterCloud>` had
   no `key`, so React reused the *same* `LetterCloud` instance across
   different letters instead of mounting a fresh one each time. Its
   internal refs (fade opacity, "have I already fired
   `onFadeComplete`") never reset between letters: the game worked
   perfectly for the first encounter, silently broke on the second (its
   cloud faded to fully invisible but never fired the callback that
   advances to the next letter — looked exactly like the game hanging,
   found only by a full 6-letter playthrough, not a 1-2 letter smoke
   test). Fixed with `key={encounter.canonicalLetter}` — the correct,
   idiomatic React fix whenever a component instance represents a
   different logical thing across renders, not a prop refresh on the
   same thing.
4. **Case progression's lowercase form never reached the HUD** — the
   letter-cloud itself correctly rendered the case-progressed glyph
   (`encounter.displayChar`), but the HUD's confirmation text was wired
   to a separate `activeLetter` string that was always set to the
   canonical (uppercase) form for the scheduler lookup. A child would
   see and tap a lowercase "b" cloud, then have the HUD confirm "B" —
   silently contradicting the entire point of testing lowercase
   recognition. Found by an automated playthrough that recorded what
   the HUD actually displayed across mastered letters and got 0%
   lowercase against an expected ~100% for that set. Fixed by rendering
   `encounter.displayChar` in the HUD instead of the canonical string.
5. **Real camera yaw/pitch broke the ocean/sky shader** — added for the
   mouse-parallax feature, first as direct `camera.rotation.x`/`.y`
   mutation layered on top of `lookAt()`'s own orientation. Looked
   fine at small, centered mouse positions; a screenshot at a mouse
   position near the viewport corner showed half the frame go flat
   gray — OceanSky feeds the camera's orientation into the shader
   through a hand-rolled `fromEuler()` that (per its own doc comment)
   was only ever proven correct for gentle roll/banking, not real
   yaw/pitch. Fixed two ways: (a) express the parallax as a `lookAt`
   **target** shift instead of a raw rotation mutation — still genuine
   camera rotation, just produced the way the rest of this scene
   already does it safely, and (b) clamp the shift's magnitude well
   inside the range confirmed to render correctly. The albatross's own
   parallax-driven yaw/pitch (a normal mesh, not the background shader)
   needed no such caution.
6. **Bug #3 again, one layer deeper, for endless mode** — the
   `key={encounter.canonicalLetter}` fix from bug #3 implicitly assumed
   every encounter in a session has a distinct letter, true for a
   classic mission (`buildMissionQueue` shuffles the pool *without*
   replacement) but false for endless mode's `pickEndlessItem` (*with*
   replacement — repeats are the whole point of "endless"). Two
   consecutive encounters sharing a letter hit the exact same symptom
   as bug #3: the second cloud's burst never fired its completion
   callback, silently stalling the mission. A second, subtler instance
   of the identical mistake was hiding in `alreadyPassedRef` (a `Set`
   guarding "don't fire `onPassed` twice for the same encounter"), also
   keyed by letter — it would permanently block the fly-through fade
   for any letter that had already passed once earlier in the session.
   Both fixed by keying on `encounter.distance` instead, which is
   unique per spawn regardless of letter repeats. Lesson generalized:
   anywhere state is keyed by a domain value (a letter) to mean "this
   specific encounter", check whether that value is actually guaranteed
   unique in every mode the code runs in — it was, until endless mode
   changed the assumption out from under it.

Also worth knowing for future testing in this environment: headless
Chromium throttles `requestAnimationFrame` to roughly **1fps** when the
page isn't visible/focused (confirmed by direct measurement). Playwright
waits of 1-2 seconds are not enough to observe animated changes — use
4-5+ second waits (or better, assert on the actual uniform/state value
rather than a screenshot diff) when testing anything frame-loop-driven
here.

## Interaction loop — built and verified end-to-end

Per the user's decision, flying straight through a letter-cloud is the
intended payoff, not something to engineer around with collision
avoidance — `FlightScene.tsx`/`LetterCloud.tsx`'s fade-on-pass exists
specifically to make that moment feel like a beat, not a glitch.

Verified for real, not just component-by-component: fresh onboarding →
lands directly in the flight game → tap a cloud → HUD opens showing
that exact letter → "Knew it!" → HUD dismisses, flight resumes →
`localStorage` shows the *existing* scheduler correctly processed it
(`box` 0→1, `reviewGap` set to `INTERVALS[1]`, matching
[05-spaced-repetition.md](./05-spaced-repetition.md) exactly) — zero
console errors through the whole run. `App.tsx` now routes here by
default; Dashboard is reachable via the top-left gear icon; Onboarding
is unchanged. Since extended to a full automated 6-letter mission
playthrough (mixed correct/incorrect answers) ending in the real end
screen with an accurate session logged — this is what caught bugs #3
and #4 above, which a single-encounter test couldn't have.

Per the user's spec, deliberately simple for v1 ("just for now"):

1. A cloud shaped like a letter comes into view ahead on the flight
   path.
2. Child taps it → `speak(letter)` (reuse `engine/audio.ts`, already
   built and voice-improved).
3. Left/right arrow UI appears: right = "I knew it", left = "I didn't."
   This is **self-report**, not an objective check — a deliberate v1
   simplification per the user, not a bug to "fix" without being asked.
4. Self-report feeds `engine/scheduler.ts`'s existing `applyAnswer`
   exactly like the old quiz did (right arrow = correct, left =
   incorrect) — the Leitner box math, review-gap logic, and
   `docs/06-data-model.md` data shape are **reused as-is**. What's
   replacing is the screen, not the progress model underneath it.

## Letter selection & case progression — built and verified with real mastery data

`engine/flightMission.ts` (pure functions, no React/Three — testable in
isolation): `computePoolSize(letters)` starts the pool at the first 6
curriculum letters and grows it by one for every letter at `box >= 4`
(capped at 26). `buildMissionQueue(letters, length)` draws a random
`length`-letter subset (default `MISSION_LENGTH = 6`) from that pool in
shuffled order, and per letter independently rolls whether it displays
upper or lowercase: chance is 0 below `box 2`, ramping linearly to
"always" by `box 4` (`(box - 1) / 3`, clamped 0-1) — a letter's
uppercase recognition has to already be solidifying before its
lowercase form gets thrown in at all.

Verified by seeding real mastery data (A-F at `box 4`) and playing
multiple real missions: letters up to K appeared (pool correctly grew
from 6 to 12 = 6 base + 6 mastered), and mastered letters displayed
lowercase in roughly the expected proportion (3 of 6 in one recorded
run, all and only from the mastered set) — not just that the function
returns the right shape, that an actual playthrough produces the right
distribution. This is also where bug #4 above was caught.

## Session logging — built

`FlightGameScreen` tracks `practicedRef`/`correctCountRef`/`totalCountRef`
and a real `sessionStartedAtRef` across one mission, and calls the
existing `logSession` (same shape [06-data-model.md](./06-data-model.md)
already defined) when the mission ends, success or time-up alike.
Verified: Dashboard's streak and "Time This Week" correctly reflect a
completed flight mission.

## The bird model — built

The Meshy GLB the user originally picked was blocked behind a paid
plan (confirmed by navigating the real download dialog, not assumed) —
worked around at the time with a simple geometric stand-in
(`AlbatrossPlaceholder.tsx`: capsule body, cone beak/tail, two flat
swept wings). The user later downloaded a **binary STL** instead
(`Exported from Blender-4.0.0`, 50k triangles, geometry only — no
material/rig/animation) to `public/models/albatross.stl`, which
`three/AlbatrossModel.tsx` now loads via `three/examples/jsm/loaders/
STLLoader.js` (through R3F's `useLoader`, which suspends — needs the
`<Suspense fallback={null}>` boundary added around `<FlightScene>` in
`FlightGameScreen.tsx`) and this fully supersedes and replaces the
placeholder (deleted, not kept around — there was no ambiguity about
which one to use once the real model worked).

**Orientation/scale — got it wrong once, fixed properly.** First pass
shipped at identity rotation, scale 6, based on an in-game screenshot
at a blown-up size that looked like a plausible "flying away from the
viewer" pose. The user immediately called this out as too large and
not actually looking like a game bird (wings should read as a clean
horizontal spread, not whatever that was) — a fair correction. Instead
of guessing again, built an isolated inspection page (raw three.js +
`STLLoader`, no game code) rendering the mesh from front/top/side/iso
with axis helpers, which unambiguously showed the mistake: the
model's **wingspan is its longest raw axis** (`Z`, ~1.19 units), which
had been read as the "forward/beak" axis (actually the medium one, raw
`X`, ~0.47) — an easy mix-up since nothing about a bounding box alone
tells you which long axis is "wings" vs. "body". The fix is a 90°
rotation about `Y`, `rotation={[0, Math.PI/2, 0]}`, which remaps the
model's `Z` (wingspan) onto the game's world `X` (left-right on screen)
and points the beak toward world `-Z` (away from the chase camera).
Scale corrected to 2.3 against the now-right axis. Lesson: a bounding
box tells you the three extents, never which extent means what — that
still has to come from actually looking at the shape.

**Flapping.** A plain STL has no separate wing objects — confirmed via
a connected-components check across all 50k triangles (union-find over
vertices snapped to a shared grid, since STL doesn't share vertices
between triangles): exactly **one** island, this is a single fused,
watertight mesh, not several objects merged for export. So there's no
existing seam to animate along; `three/AlbatrossModel.tsx` cuts one
itself, splitting triangles into left-wing/right-wing/body purely by
each triangle's average coordinate on the wingspan axis
(`WING_SPLIT_THRESHOLD = 0.1`, tuned the same isolated-page way: color
the two sides differently, render top-down, adjust until the boundary
falls at the visual wing root instead of into the body). Each wing's
extracted geometry is re-centered on its own root before being placed
in a `<group>` positioned back at that root — the pivot has to be at
the shoulder, not the model's origin, or rotating it would swing the
wing through the body instead of flapping it at the joint. A
`useFrame` then oscillates each wing group's `rotation.x` in mirrored
sine waves. Verified across three spaced screenshots that the wingtip
angle genuinely changes frame to frame and the cut is invisible even
mid-flap (no visible gap or seam at the root) — not just "should
work," the same standard as everything else in this doc.

## Flight scene — built and visually verified

`three/FlightScene.tsx`: a chase camera follows a point moving forward
at a constant speed (`speed` world-units/second) with a slow sinusoidal
bank for a soaring feel; `OceanSky` renders behind it; the bird model
sits ahead-and-below the camera. Confirmed working: the
bird reads clearly as a gliding seabird silhouette against real
ocean/sky, forward motion is smooth over multiple screenshots taken
seconds apart, zero console errors.

**Sequential spawning, not "place them all up front."** Only ever one
letter-cloud exists in the world at a time — `FlightGameScreen` spawns
the next one (at the previous spawn distance + a fixed spacing) the
moment the previous finishes fading, rather than pre-placing all 6
missions letters at fixed distances. This was originally a visual
overlap problem (two clouds placed close together could appear near
each other from the camera's angle); solved architecturally rather than
by tuning spacing numbers, which also fixed a real perf/complexity
non-issue (only ever one cloud's puffs are live at once) as a bonus.
Per the user: flying **straight through** a letter-cloud (no collision)
is the intended charming payoff, not something to engineer around.

## Mission timer & day cycle — built

`FlightScene` owns a mission clock internally (`missionElapsedRef`,
paused in step with forward flight during HUD interactions — so
thinking time never costs mission time, consistent with this project's
no-frustration stance throughout). `onMissionTimeUp` fires once when
elapsed time crosses `missionDurationSeconds` (parent-configurable, see
"Concept" above); `FlightGameScreen` treats that exactly like
"collected all the letters" for ending the mission, just with different
(still warm, non-punitive) end-screen copy — see "Intro & end screens"
below.

`timeOfDay` (dawn → noon → sunset → night) is driven by whichever is
**further along**: elapsed-time fraction, or `missionProgress`
(`planIndex / missionPlan.length`, passed down as a prop). Time alone
was tried first and was wrong in practice — the keyboard/picture bonus
paths can clear all 6 letters in well under a minute, so a typical
round never got the sky past "afternoon" even though the shader
(`oceanSky.ts`'s `getSkyColor`) already has full moon and star
rendering sitting unused. Taking the max of the two means a fast round
still drives the sky through its arc — by the last letter or two of a
normal round, real night with stars is genuinely visible — while a slow
round still reaches night at the actual time limit. Fed to `OceanSky`
via a live ref (`timeOfDayRef`), not a React prop — see `OceanSky`'s
doc comment for why a continuously-changing value has to bypass React's
render cycle to animate smoothly. One knock-on fix: the "collected all
letters" end-screen copy used to say "before sunset", which is now
usually false (finishing the round is exactly when night has often
fallen) — reworded to not claim a time-of-day it can't guarantee.

Because `missionProgress` jumps in discrete per-letter steps, the raw
target time-of-day would otherwise pop the sky instantly forward every
time a letter resolves (right or wrong — any resolution advances the
round the same way). `displayedTimeOfDay` eases toward that target
instead of snapping to it (same damped-exponential pattern as the mouse
parallax), so resolving a letter reads as a quick, visible time-lapse
glide across a couple of seconds rather than a jarring cut.

## Endless mode — built

A second mission mode, picked on the intro screen (`Mode` toggle) before
"Take Off!": no fixed round length — `pickEndlessItem` draws one random
letter from the current pool each time a new encounter is needed
(repeats expected and fine, see bug #6 above), and the round just keeps
going. The night clock always creeps forward, but every correct answer
(`correctTick`, incremented in `handleAnswer`'s knew-it branch and in
`awardBonusSolve`) rewinds it by `missionDurationSeconds * 0.15` — so
accuracy directly "postpones" night, per the user's framing, rather than
the round having anything to finish. `FlightScene`'s clock math branches
on `mode`: classic keeps its time-vs-progress `max()` from above;
endless computes `effectiveElapsed = elapsed - correctTick * rewindSeconds`
and derives `frac` from that against the same `missionDurationSeconds`
setting (reused as endless's *base, no-bonus* pace, so "Flight Length"
means one consistent thing in both modes). Ends only when the clock
finally reaches night despite the rewinds — a new `'endless'` end
reason with its own warm copy ("Night finally caught up with you..."),
never the "collected" reason since there's nothing finite to collect.
The topbar's progress pill also branches on mode: classic keeps
"X/Y letters found"; endless shows a plain running count since there's
no Y.

## Reset progress — built

A "Reset all progress" button in the parent Dashboard
(`state/AppContext.tsx`'s `RESET_PROGRESS` action). Clears every
letter's mastery back to box 0, `starsTotal`, and session history — but
keeps the child's `profile` and `settings` (mission length preference),
since this is "start training over", not "delete the child" or "forget
how long they like to fly". Guarded by a plain `window.confirm()` —
low-tech but real: irreversible and destructive enough that an
accidental tap shouldn't be able to fire it silently.

## Intro & end screens — built

Plain DOM/CSS, no `<Canvas>` mounted until the child actually taps
"Take Off!" (cheap, and gives a natural place to preview the mission,
and to pick Classic vs Endless — see above). End screen closes the
narrative loop the user actually asked for (flying home to the nest): a
small inline SVG nest-with-chicks illustration, a per-letter summary
(knew it / needs practice, derived from real answers this session,
regardless of mode), "Fly Again" (skips straight back into a new
mission with the same mode last picked — the intro screen is a
first-play-only beat, not a tollgate on every replay), and a link to
the Dashboard. All three end reasons (collected, time, endless) land
here with different headline/copy, all deliberately framed as an
accomplishment ("You're home for the night!" not "you lost") — matches
the pedagogy doc's errorless-leaning feedback principle applied to the
mission level, not just per-answer.

## Rig tool — built

`three/RigTool.tsx`, reachable only at `?rig=1` (checked in `App.tsx`
before the normal profile/onboarding flow — completely separate from
the game). Replaces the wingspan-threshold split above with a proper
hand-placed skeleton: loads and centers the same STL, outlines it
(`EdgesGeometry`, not a full per-triangle wireframe — see below), and
lets you click points on the model to drop named joints, each
optionally parented to an earlier one (drawn as a bone line). "Copy
joints as JSON" exports `{name, parent, position}[]` in the exact same
centered coordinate space `AlbatrossModel.tsx` already uses, so the
result plugs in directly.

**Deliberately raw three.js, not React Three Fiber**, despite every
other 3D piece in this app using R3F. An R3F `<Canvas>` rendering this
exact geometry reliably lost its WebGL context on load — confirmed via
systematic isolation, not guessed: removed the wireframe material
(switched to the cheaper `EdgesGeometry`), removed `OrbitControls`,
fixed an accidentally huge near/far ratio, switched `frameloop` to
`"demand"`, constrained `dpr` and `gl` options — none of it stopped the
crash, right down to a single solid mesh under one ambient light with
nothing else in the scene. The same geometry rendered via plain
`THREE.WebGLRenderer` (this file's actual approach) stayed completely
stable through repeated manual renders. Since this tool has no real
"scene graph state" to
reconcile — it's an imperative editor, not a game with per-frame
declarative state — dropping to raw three.js sidesteps whatever the
real R3F/Canvas interaction problem was rather than continuing to spend
time chasing it. Bonus finding along the way: this machine's GPU is
shared with other running apps (Steam, VS Code both had live GPU
processes, confirmed via `pgrep`), which is likely *why* this
environment is more fragile than a typical clean CI sandbox — worth
remembering for any future "why did this randomly break" moment.

Adopting the bird-flight literature the user pointed at
([Wu & Popović, SIGGRAPH 2003](https://grail.cs.washington.edu/projects/flight/wu2003realistic.pdf))
wholesale isn't practical here: it's an offline physics pipeline
(articulated rigid-body dynamics, per-feather aerodynamic lift/drag,
simulated-annealing optimization taking *hours* per flight path on a
dedicated physics engine) meant for pre-rendering animation clips, not
a real-time technique. What's directly usable without any of that
machinery: its skeleton has a **shoulder → elbow → wrist** chain per
wing, the wing visibly folds on the upstroke and extends on the
downstroke, and its wingbeat is parameterized by two pure, cheap
functions of phase (`g1`, `g2` — see "Wing rig" below) with no
simulation involved. Both are now built.

**Position estimates — from the mesh, not guessed.** Rather than
manually clicking shoulder/elbow/wrist in the rig tool, joint positions
were estimated geometrically: sampled the body's front-to-back
cross-section thickness at Z-slices to find where it drops sharply
(z≈0.06→0.08 in the centered mesh — that's the actual shoulder, where
torso ends and thin wing begins), then placed elbow/wrist/wingtip at
span-fractions matching typical albatross wing-skeleton proportions
(~18% humerus, ~23% forearm, ~59% hand-wing — the very long "hand"
section is characteristic of a long-distance dynamic-soaring seabird),
and took the X/Y centroid of the mesh's actual cross-section at each
station rather than assuming the wing is flat. All of this lives in
`three/albatrossRig.ts`, shared by both `AlbatrossModel.tsx` (drives
the real animation) and `RigTool.tsx` (seeds these as visible, draggable
starting joints — not just numbers trusted blind, see "Rig tool" above,
now updated to load them by default instead of starting empty).

**Wing rig — built.** `AlbatrossModel.tsx`'s old single-hinge split
(one threshold cut per wing, which read as the model being sliced) is
replaced by `WingSide`: three real segments (upper arm, forearm, hand)
extracted from the mesh by Z-band and nested in a nested `<group>`
hierarchy — shoulder pivot containing an elbow pivot containing a wrist
pivot — so rotating the shoulder correctly carries the whole rest of
the wing with it, same as a real skeleton. Driven every frame by the
paper's actual composite functions, ported verbatim into
`albatrossRig.ts`: `g1(down, up, phi)` is a smooth full-cycle
oscillation (used for shoulder dihedral — the main up/down flap); `g2`
holds flat through the whole downstroke then swings out and back during
the upstroke only (used for elbow/wrist bend — matching the paper's
description of real birds folding the wing inward on the upstroke to
cut drag, holding it extended through the power stroke). The actual
angle magnitudes (`DIHEDRAL_DOWNSTROKE/UPSTROKE`,
`ELBOW_BEND_PEAK`/`WRIST_BEND_PEAK`) and the wingbeat period are chosen
by eye, not fitted to anything — the paper derives those per-bird from
an optimizer we don't have and measurements we don't have either; only
the *shape* of the motion (the equations) is adopted, not any specific
bird's tuned numbers. One real sign-convention bug worth remembering:
each wing segment's geometry is re-centered on its own joint, so its
local Z keeps the ORIGINAL side's sign (all-negative for the whole left
wing, all-positive for the whole right) — rotating both sides by the
identical angle around local X raises one wing and lowers the other (a
roll, not a flap); the fix is negating the angle by `sign` per side,
confirmed by screenshot that both wings now rise and fall together.

**A real bug the rig tool's own joint markers caught.** After seeding
default joints, they were invisible in the 3D view (spotted by the
user, not found here first) despite the side-panel list correctly
showing all 9. Root cause: React 18 StrictMode double-invokes effects
in dev (mount → cleanup → mount) — the marker-sync effect caches sphere
meshes in a `Map` ref and only calls `group.add()` the first time a
sphere is created, reusing the same mesh object on every later sync.
The scene-setup effect's second mount creates a brand-new, empty
`markerGroup`, but the cached spheres from the first (now-disposed)
scene never get migrated to it — they exist, update position
correctly, just aren't part of the scene actually being rendered. The
bone lines never showed this because they're fully torn down and
rebuilt from scratch on every sync, never cached. Fixed by clearing the
sphere map in the scene-setup effect's cleanup, forcing a full rebuild
against whatever scene is actually current.

**Horizon tilt — a real tuning bug, not a rendering one.** The mouse
roll and turn-banking values (0.24 and 0.4) could combine to swing the
camera's roll up to ~25° at once — reported as "the horizon is very
tilted", correctly, since that reads as the world being crooked rather
than a gentle bank. Both scaled down roughly 3x (bank multiplier
0.4→0.12, mouse roll multiplier 0.24→0.07) so the worst case lands
under ~10° — confirmed via screenshot, not just by the arithmetic.


## Polish pass (Sep 2026) — what changed and why

A single "make it feel finished" sweep over the whole app, driven by
actually playing it in a headless browser and screenshotting every
screen at tablet and phone widths — every item below was a visible
problem in a capture, not a guess. Grouped by what a player feels:

**Feel & feedback**
- Synthesized sound design (`engine/sfx.ts`, Web Audio, zero assets):
  a tap tick, a two-note chime for "Knew it!", a rising sparkle for
  every bonus path, a soft (never harsh) tone for "Not yet", a noise
  whoosh when flying through a cloud, a pop for the bubble-burst, a
  swell on take-off, a settling chord on landing, and a fanfare when a
  letter is newly mastered. Plus a very quiet wind + sea bed that fades
  in on take-off and ducks while a letter is being spoken. Parent-
  toggleable (`Settings.soundEnabled`, in the pause menu and the
  dashboard); spoken letters are never muted by it. Unlocked on the
  Take Off tap per browser autoplay rules. Haptic ticks on Android.
- A live star counter in the top bar (stars used to accumulate into a
  number no screen ever showed) with a bump animation; the "+N stars"
  toast now anchors under it.
- Classic mode's "3/6 letters found" text pill is now six letter slots
  that fill in as each cloud resolves — green for "knew it", gold for a
  bonus solve, soft for "not yet", faint for a cloud that drifted past.
  Raw numbers stay out of the child's HUD, per the design system.
- "Knew it!" now has an in-world beat too: the cloud warms to a sunlit
  gold and swells once (`LetterCloud`'s `tint`), instead of nothing
  visibly changing until the fade.
- End screen rebuilt: evening sky with stars, stars earned this flight,
  letter chips with outcomes, and — the reward loop the flight game had
  dropped when it replaced the Celebration screen — a "New letter
  mastered!" banner with confetti for any letter that crossed into box
  4 during this flight. Copy is honest: "every letter found" only when
  every planned letter actually got an answer.
- Every button squishes on press, has a real focus ring, and the
  primary CTA breathes. Screens stagger their content in.

**Flight scene**
- `flat` on the R3F `<Canvas>`: the ocean/sky is a custom shader that
  ignores tone mapping, so ACES was compressing only the *foreground*
  (letter clouds, bird) to a dull grey against an uncompressed sky.
  Clouds are now white. Confirmed side-by-side.
- The moon rendered as a solid black disc against the dawn/dusk sky
  (its unlit half was pure black, blended in at 100% whenever
  `day_blend` was 0). Now has an earthshine floor, fades out with
  sunset glow, and uses a cubic falloff so it is gone by mid-morning.
- Mission start moved from 6 to 7: 6 rendered as a dark-blue sky with an
  orange band, indistinguishable from dusk (so a mission looked like it
  started and ended at night). 7 is a soft pink-blue morning.
- Chase-cam lifts its aim toward an approaching cloud so the glyph
  stays framed instead of sliding off the top of the screen on final
  approach.
- Letter clouds cool toward moonlit blue-grey at night (`nightDimRef`)
  instead of glowing noon-white under a starfield.
- Spawn distance 26 → 32 (~8s of approach instead of ~6.5s).
- The bird mesh and the fonts the clouds are rasterized from are
  preloaded during the intro (`engine/preload.ts`), with a "Spreading
  wings…" veil if a flight starts before they're ready — previously
  the bird popped in late and the very first cloud could sample a
  fallback font.

**Chrome & tablet hygiene**
- Pause menu (pause button / Esc / tab hidden): keep flying, fly home
  now (ends the mission honestly and logs the session), sound toggle,
  and the grown-ups gate. Previously the only in-flight control was a
  gear that jumped to the parent dashboard and silently dropped the
  session.
- Press-and-hold "Grown-ups" gate (`components/HoldButton.tsx`) on
  every path into the dashboard — no padlock, per the design rules.
- Device-aware hints: a touch-only tablet never sees "type the letter"
  or "(Space)"; one rotating hint per encounter instead of two
  permanent pills.
- `100dvh`, `overscroll-behavior: none` (no pull-to-refresh mid-
  flight), `user-select: none` (no text-selection on long press),
  `touch-action: none` on the canvas (a finger drag is a trace, never a
  scroll), safe-area insets, favicon + web manifest + app icons.
- The HUD's big letter is Nunito, not Baloo 2 — the design system's
  own rule (Baloo's terminals distort the letterform being learned),
  which the HUD had been violating. Shows the other case underneath.

**Surrounding screens**
- Onboarding and the player picker now lead with the albatross (the
  fox belonged to the earlier "lost Letter-Song" concept — a child met
  the fox, then flew an albatross, two stories stapled together), and
  the avatar picker shows actual animal faces instead of five coloured
  discs. Enter submits; the level grid collapses on phones.
- Dashboard: at-a-glance stats (stars, mastered, streak, minutes), a
  real day-streak (`computeStreak` was implemented but unused; the old
  label "N-day streak this week" was actually "days practiced"), letter
  badges next to words, mastery-step dots, a two-step in-app reset
  confirmation instead of `window.confirm`, and responsive breakpoints
  (it overflowed the viewport on a phone).


## Tilt camera + stroke guide (Sep 2026, second pass)

**Gyro parallax on tablets/phones** — `engine/tilt.ts`. The desktop
mouse-look (FlightScene's `mouseTarget`, heavily damped before it
touches the camera or the bird) is now also fed by `deviceorientation`
on touch-first devices, so the same "look around the sky" feel exists
on a tablet held in the hands. Details worth knowing:

- The neutral pose is whatever the child was doing at take-off
  (`recenterTilt()`), and it auto-centers toward the current holding
  position with a ~10s time constant — a deliberate tilt reads as a
  tilt, slumping into the sofa doesn't leave the camera craned.
  Verified by driving the module with synthetic events: a held tilt
  reads 0.99 immediately and decays to 0.05 after 30s of samples.
- Device beta/gamma are remapped into screen space per
  `screen.orientation.angle`, so landscape works (`toScreenSpace` is
  the single table to flip if a real device reports the opposite sense
  for one rotation — the mapping was verified for portrait against the
  intended signs, not on physical hardware for every rotation).
- ±11° of tilt = full parallax; clamped beyond.
- iOS 13+ needs `DeviceOrientationEvent.requestPermission()` from a
  gesture: FlightGameScreen calls it on the Take Off tap, un-awaited.
- While tilt readings are live, `mousemove` is ignored — a touch tap
  fires a synthetic mousemove at the tap point that would otherwise
  yank the view toward wherever the child last tapped.
- Only enabled on `(hover: none) and (pointer: coarse)` devices; a
  laptop with an accelerometer must not fight its own trackpad.

**Trace visibility + the stroke guide** — `three/LetterTracer.tsx`,
`three/StrokeGuide.tsx`, `engine/strokeGeometry.ts`,
`three/guideTextures.ts`.

- *Why the trace showed behind the letter:* the trail sprites sat at
  the cloud's own depth, and the puffs are depth-jittered ±0.3 — plain
  transparent sorting put the trail behind whichever puffs happened to
  be nearer. Fixed properly: the whole tracing layer sits 0.9 units in
  front of the cloud, every guide/trail material has `depthTest` off,
  and explicit `renderOrder` bands (cloud 0 → guide 10-17 → trail
  20-23) decide the stacking. The ribbon is now a dense gold core
  ribbon with an additive halo and a pulsing bright tip at the finger,
  and it tapers toward its older end so it reads as a stroke with a
  direction.
- *The guide:* `data/letterStrokes.ts`'s teaching-order paths (built
  for the retired "watch it get written" animation) are reused. They
  live in a schematic 100×120 viewBox whose proportions don't match
  Nunito Black, so `strokeGeometry.ts` fits each letter's stroke
  bounding box onto that letter's own sampled cloud footprint (inset by
  half a stem, since the strokes are centerlines), non-uniformly, per
  letter. Arc-length sampling uses a hidden SVG path's
  `getPointAtLength` — the data has `A`/`Q` commands and a hand-rolled
  parser wasn't worth it. Rendered as: a numbered start marker per
  stroke, a dashed golden path, an arrowhead at each stroke's end, and
  a bright comet that runs the strokes in teaching order on a loop —
  direction shown by motion, not just arrows. Start markers and
  arrowheads that would land on each other (B, D, P, R: stem and bowl
  share a start and an end) are nudged along their own stroke so both
  stay visible and correctly pointed — caught in screenshots, where
  two overlapping arrowheads at different angles read as a star.
- *Bloom is faked:* opaque gold cores (normal blending — visible over a
  white daytime cloud, where an additive sprite vanishes into white)
  under large soft additive halos (the actual glow, against the sky). A
  real post-process bloom would also bloom the sun, moon and every
  ocean highlight and cost a full-screen pass on a tablet.
- The guide fades out while the child is drawing and returns ~1.6s
  after they stop; following it is taught, not enforced — coverage of
  the glyph still decides the bonus, so a child who writes the letter
  their own way is never penalized.
- A mouse hovering the cloud for 2s flips its case, and a mouse-traced
  child hovers by definition — the swap is now suppressed while a
  trace is in progress (`engine/traceActivity.ts`), so it can't
  rebuild the glyph and wipe a half-drawn ribbon.
- Tracing also works on a cloud that's been tapped (HUD open, flight
  frozen) — verified end to end: tap → trace on the frozen cloud →
  "Traced it! +3 stars" → bubble burst.

**Third pass — trace at the child's own pace.**

- *The flight freezes from the first touch of a trace.* `LetterTracer`
  reports `onTraceActive(true/false)` on the engaging pointer-down and
  the pointer-up; FlightGameScreen turns that into `tracingHold`, which
  joins the `paused` condition (forward motion + mission clock stop) and
  also freezes the mouse/tilt parallax (`lookFrozen`) — on a tablet the
  act of drawing wobbles the device, and the gyro would otherwise nudge
  the very letter being traced. The hold lingers 2.5s after the finger
  lifts (`TRACE_HOLD_RELEASE_MS`) so a multi-stroke letter can be drawn
  with pauses between strokes; it's released outright the moment the
  letter resolves. Verified by screenshot: the cloud sits pixel-still
  from the first touch, through a lift-and-pause, into a second stroke.
- *Leniency:* coverage radius 1.35 grid cells (was 1.0) and threshold
  50% of the glyph's footprint (was 60%). Slowness is no longer
  penalized at all since the cloud can't drift past mid-trace.
- *Glow, then pop:* a completed trace no longer bursts instantly. The
  encounter enters a `'glowing'` status for `TRACE_GLOW_MS` (300ms):
  `LetterCloud`'s `glow` prop drives the puffs to an over-bright warm
  gold (colour components > 1 — with tone mapping off that pushes the
  soft edges toward white, the closest thing to a bloom flash without a
  post-process pass), full opacity and a 16% swell, while the ribbon
  thickens and whitens; the stars/sfx/speech fire at the glow's start,
  the pop sfx + toast at the burst. Only the trace path glows (the ask
  was specific to it); `awardBonusSolve`'s `glowMs` option makes it a
  one-line change to give typing/saying/picture-picking the same beat.
  Captured frame-by-frame in a small headless viewport: ribbon → whole
  cloud lit → bubble burst.
- Test-harness note for whoever verifies this next: `locator(...).textContent()`
  on an element that isn't there auto-waits 30s before failing — every
  "mysteriously slow" trace test in this pass was that, not the app
  (measured: 8fps and ~150ms per input event in headless SwiftShader).
  Use `document.querySelector(...)?.textContent` in `page.evaluate`.


## Stroke-complete tracing + the lined writing page (Sep 2026, fourth pass)

**Every part of the letter, or it doesn't count.** The sky tracer's
earlier footprint-coverage rule ("60% of the glyph's area was touched")
let one wide scribble finish a letter halfway through. Scoring is now
per stroke against the same teaching-order paths the guide draws:
checkpoints every 10 sample-px along each stroke, a stroke is done at
80% of its checkpoints, the letter only when every stroke is done.
Lenient about the manner (34px tolerance, no order or direction
enforced, a stroke can be drawn in pieces) and strict about the parts.
Two refinements after a real playtest on the 'h' (the arch counted as
done while the child was still coming down its right leg, and the
letter resolved under their finger): a stroke's FIRST and LAST
checkpoint must both be reached, with a tighter 22px radius — the 80%
rule alone can be satisfied with the last third of a stroke never drawn,
because the wide tolerance covers checkpoints ahead of the finger — and
the letter only resolves when the finger LIFTS after the last stroke,
never mid-stroke. Verified on a lowercase 'y': the second stroke stopped
45px short of its end stayed pending even after lifting; finishing the
tail resolved it, and only after the lift. The writing page's scorer
applies the same endpoint rule.
The guide's dashed dots ARE the checkpoints, so they light up as they're
covered, a finished stroke's number and arrowhead go lit, the comet
re-plans its loop over only the strokes left, and a soft bell marks each
finished stroke. Verified with a self-calibrating headless test that
maps the real stroke geometry onto the on-screen guide (found via the
gold pixels in a screenshot): for D, the stem alone traced twice left the
letter pending; the bowl then completed it. A gesture that covers a
checkpoint is never mistaken for a tap (dotting an i is a dab).

**The lined writing page** (`components/WritingPractice.tsx`,
`engine/writingScore.ts`, `getStrokePolylines` in
`engine/strokeGeometry.ts`). Every third traced letter, before the next
cloud spawns, a 2D page slides over the frozen sky: three dashed
handwriting lines (cap, x-height, baseline — the stroke data's own
metrics) that draw themselves in with a shimmer, and three slots.
"Write the letter three times." Slot 1 is assisted with the same
numbered, arrowed, comet-led guide; slots 2 and 3 are freehand. The
freehand scorer fits the letter's template onto the bounding box of
whatever the child drew before checking per-stroke coverage, so size and
position are forgiven but a missing part is not, and an adherence check
(most of the ink must lie near the strokes) rejects a scribble that
merely fills the box. A slot that passes turns green with a badge; all
three pay +2 stars and the flight resumes. "Show me" brings the guide
back on any freehand slot, "Start over" clears the slot, "Skip for now"
always exits — a child is never trapped. Parent setting
`Settings.writingPractice`: 'first-assisted' (default — guided once,
then solo, which is how handwriting is actually taught),
'always-assisted', or 'off'. Verified end to end headlessly: three
traces → page opens → guided slot, a smaller offset freehand C, a larger
freehand C → "Beautiful writing!" → +2 stars → next cloud.

Test hooks added for this: the game root carries
`data-encounter-letter` and `data-encounter-status` (nothing in the UI
reads them).


## Gesture-locked stroke scoring (Sep 2026, fifth pass)

**The real bug:** tracing 'd' by drawing only its straight stem
completed the whole letter — the bowl was never touched. Root cause
was two layers deep, both found by instrumenting the actual scoring on
a real letter rather than guessing:

1. Per-checkpoint distance scoring (added in the previous pass to
   require every stroke) still let one stroke "steal" credit for a
   DIFFERENT, geometrically adjacent stroke: 'd's bowl spans x 30-70 and
   its stem sits at x=70, right on the bowl's own edge (b/p/q are the
   same, gaps of 0-4px in the raw letterform). With a tolerance wide
   enough for a real finger, tracing only the stem landed within
   tolerance of most of the bowl's checkpoints too.
2. The obvious fix — gate each point to whichever single stroke it's
   actually NEAREST to (`nearestStrokeIndex` in
   `engine/strokeGeometry.ts`) — still wasn't enough. Instrumented on a
   real 'A': at the two points where its V-shaped first stroke crosses
   the crossbar's own height, distance to the V's own nearest checkpoint
   and distance to the crossbar's nearest checkpoint came out **4.80 vs
   4.64** and **1.04 vs 0.93** — a coin flip, because a crossbar is
   *constructed* to touch both legs. Any letter with one stroke built to
   touch or run close against another (not just b/d/p/q) hits the same
   ambiguity right at the touch point.

**The actual fix:** stop deciding "which stroke" per point. Decide it
once, from wherever a continuous drag *starts*, and hold that stroke
fixed for the rest of that same drag — `activeStrokeRef` in
`LetterTracer.tsx`, reset to `null` on every pointer-down. A drag that
begins unambiguously on the stem (far from the bowl) can never be
reattributed mid-stroke just because it later swings close to
something else, even at an exact touch point. The lined writing page's
`scoreWriting` (`engine/writingScore.ts`) got the equivalent fix:
scoring now walks `drawn` as a list of GESTURES (one array per
continuous pointer-down-to-up drag — the shape it was already in,
just previously flattened away too early) and locks each gesture to
the nearest not-yet-done template stroke from its first point.

**Verified two ways**, both against the exact production functions
(imported from the running app, not reimplemented):

- Every letter A-Z, upper and lower (52 glyphs), for both scorers: any
  single stroke traced alone (as its own drag) never completes a
  multi-stroke letter; tracing every stroke completes it. First run
  (nearest-point-only, no locking) failed exactly on A and B — the
  predicted crossbar/touch-junction case — confirming the mechanism,
  not just patching the reported symptom.
- A real pointer-drag check through the actual 3D scene (canvas
  raycasting, camera projection, the whole path) for 'd' specifically.

Both scorers' fixes live behind the same shared `nearestStrokeIndex`
helper so the two implementations can't drift apart on this rule again.


## Handwriting-check model: polarity bug found and fixed (Sep 2026)

A trained classifier (`public/models/letters/` — 52-class A-Z/a-z,
28x28 grayscale, reported 87.46% test accuracy) was dropped in behind
the "write it on paper" webcam bonus (`components/HandwritingCheck.tsx`,
`engine/handwritingMatch.ts`, `engine/handwritingModel.ts`) per the
existing "drop a file in, no code changes" contract
(`public/models/letters/README.md`). It loaded and ran inference
without error — but that only proves the plumbing works, not that the
predictions mean anything, and a decisive check showed they didn't:

**The bug:** `classifyHandwriting` fed the model a normal photo —
dark pencil ink on light paper, upright, exactly what
`handwritingMatch.ts`'s own `DARK_THRESHOLD` contract expects and a
real webcam photo produces. Single-channel classifiers trained the
EMNIST/MNIST way expect the opposite polarity — white ink on a black
background — and this one was no exception. Fed the natural photo
as-is, it scored **2/52 (3.8%)**, indistinguishable from random
guessing across 52 classes.

**How it was found:** tried all 8 rotation/flip combinations first
(the OTHER classic EMNIST gotcha, transpose-and-flip on the raw byte
order) — all landed at 2-8%, ruling that out. Colour polarity was the
real axis: plain upright orientation with colours inverted scored
**45/52 (86.5%)**, matching the model's own reported accuracy almost
exactly, while every rotation combined with inversion scored far
worse. Decisive, not a guess — the accuracy jump from 3.8% to 86.5%
on the IDENTICAL images (same renders, only the polarity changed)
leaves no other explanation.

**The fix:** `handwritingModel.ts` now inverts the normalized image
(`1 - value`) before feeding the model, but ONLY when `channels === 1`
— the same input-shape signal the file already used to distinguish an
EMNIST-style classifier from a Teachable-Machine-style one (224x224
RGB, MobileNet-based, trained on natural un-inverted photos, where
inverting would break it instead). Re-verified after the fix by
feeding the SAME natural, un-touched photos straight through the
public `classifyHandwriting` function with no test-side compensation:
**45/52 (86.5%) at bold weight, 43/52 (82.7%) at a thinner plain
weight** — both land right at the model's own claimed accuracy. Every
uppercase letter classified correctly; the handful of misses are
lowercase shapes a printed sans-serif font renders ambiguously even to
a human (g/q, i/l, n/h, p/b, r/l, y/v) — expected model behavior, not
a remaining app bug.

**A second, smaller bug found while verifying the fix end-to-end:**
driving the actual "Write the letter on paper for a bonus" button
through a real (fake-device) camera reproduced a genuine "Something
went wrong reaching the camera" failure — but only against the DEV
server, never against a production build. Cause: React 19 StrictMode
(dev-only) double-invokes `HandwritingCheck`'s camera-start effect
(mount → cleanup → mount); the first call's `getUserMedia` can resolve
AFTER the second mount has flipped `mountedRef` back to `true`, so it
passes the "still mounted" guard, opens its own stream, and gets
silently overwritten in `streamRef` by the second call's stream —
occasionally surfacing as the generic error state. Fixed with a
per-call generation id (`requestIdRef`, bumped on every `startCamera()`
call including manual "Try again" retries) checked alongside
`mountedRef` before touching state — a stale call recognizes it's been
superseded and just closes its stream instead of racing. Confirmed
fixed by rerunning the same driven-camera check three times against
the dev server (where the race actually reproduces); the production
build was never affected (StrictMode's double-invoke doesn't run there).

Practical effect: before this fix, `checkHandwriting`'s model signal
was voting essentially at random, so `modelAgrees` (which requires
≥60% confidence AND the right letter) almost never fired — the "smart"
check was silently running as plain shape-match 100% of the time
despite `isHandwritingModelAvailable()` reporting true. It now
genuinely adds a second, mostly-accurate signal on top of the
shape-match baseline, as designed.


## Every letter guaranteed a traceable cloud (Sep 2026)

The three mini-game rounds (plane-choice, letter-matchup, CVC word)
were each written to REPLACE a letter's normal cloud turn outright —
correct in isolation, but the interaction wasn't considered: once all
three existed together, only about 62% of a mission's letter-turns
still became an actual, traceable classic cloud (measured by
simulating `presentItem`'s exact scheduling logic across 200,000
missions). A child who happened to draw several of the mini-game turns
in a row could go a whole mission — or several — without a single
traceable letter, which is what prompted this fix.

`presentItem` now treats a mini-game strictly as a BONUS INTERLUDE in
front of a letter's turn, never a substitute for it: every branch that
opens one (plane, matchup, CVC — CVC already worked this way) stashes
the letter in `pendingPresentRef` first. `resumeAfterSpecialRound` (one
function now, replacing the old separate `advanceAfterSpecialRound`/
`advanceAfterCvcRound`) fires once that round resolves and hands the
stashed letter straight to a new `presentClassicCloud` — bypassing
`presentItem`'s own lottery entirely, so a letter that already got
diverted into one bonus round can't roll into a second one before its
real cloud ever shows. At most one mini-game per letter turn, then its
cloud, always — tap/trace/type/say/picture-choice all stay available on
it exactly as before.

Re-ran the same simulation against the new logic: every one of the
1.2M simulated letter-turns now reaches `presentClassicCloud` (100%,
by construction — no branch skips it), with 44.3% preceded by a bonus
round instead of the old ~38% that used to vanish entirely. Confirmed
against the real running app too, not just the simulation: drove a
live mission and logged the actual sequence of what appeared —
`matchup -> classic(n)`, `cvc -> classic(H)`, `plane -> classic(C)` —
every mini-game immediately followed by its own letter's real cloud.

Side effect worth knowing: this also directly eases the lined
writing-page's "every 3rd trace" cadence (see the "Trace at the
child's own pace" section above) — with every letter now eligible to
become a classic cloud, there are more genuine chances to trace per
mission than there were with mini-games eating a third of the turns
outright. Not a full fix for that cadence resetting every mission (a
separate, still-open question — see the roadmap), but a meaningful
partial one.


## The guide fading during tracing was the other half of "it disappeared" (Sep 2026)

A second, distinct cause behind "the glowing guide is gone," found by
re-verifying the mission-scheduling fix above with fresh eyes rather
than assuming the earlier screenshot proof settled it: the guide's
comet and arrowheads were designed to fade to fully invisible within
about 0.75s of the child starting to drag (`GUIDE_FADE_OUT_PER_SECOND
= 4`), on the original reasoning that a moving comet under the child's
own finger would "fight their hand." In practice that meant the single
most eye-catching part of the guide — the actual glowing demonstration
of how to write the letter — vanished right as the child started
using it, which is exactly the moment they'd want it. The dashed dots
and numbers stayed (by design, as the progress display), but a child
describing "the glow that showed me how" was almost certainly
describing the comet specifically.

Confirmed with a live, sustained two-second drag, screenshotting every
500ms: at 1s and 2s into the trace, the numbered markers, dashed path,
and arrows were all still clearly visible alongside the child's own
ribbon — no legibility conflict, since the ribbon already renders on
top of the guide at a higher `renderOrder`. The "fight the child's
hand" concern the original fade was solving for wasn't actually real.

Fix: removed the drag-triggered fade entirely (`LetterTracer.tsx`) —
the guide now stays fully visible throughout the whole trace and only
fades once the letter is completely finished, when there's nothing
left to demonstrate and the completion glow/burst takes over
immediately anyway.


## Rainbow streak reward (Sep 2026)

Every 5th catch in a row has a 20% chance (`RAINBOW_STREAK` /
`RAINBOW_CHANCE` in `FlightGameScreen.tsx`) of queuing a rainbow in
front of the **next** letter. One of its six bands slowly "breathes" (a
1.8s cosine swell plus a tinted halo), and the child picks the matching
colour from three labelled swatches at the bottom of the screen.

- **Tied back to letters.** Every colour word starts with a curriculum
  letter (**R**ed, **O**range, **Y**ellow, **G**reen, **B**lue,
  **P**urple). When the held letter is one of those, that colour is the
  one that glows, and a correct pick speaks "Red… R" before the R cloud
  appears. Otherwise any colour glows. See `engine/rainbowChoice.ts`.
- **Six bands, not seven.** Most 4–6 year olds can't reliably tell
  indigo from violet. Red and green are never offered together
  (colour-blind safety, same rule as `PlaneChoice`'s palette), and every
  swatch carries its word, so the answer never relies on colour vision
  alone. The rainbow's six bands are exactly the six answer colours.
- **A reward, not a test.** A wrong pick only shakes the swatch: no
  `breakStreak`, no `recordLetterMiss`, and letter mastery is untouched.
  A right pick gives +2 stars and doesn't feed the streak, so a rainbow
  can't summon the next one.
- **Rendered in the ocean shader, not as a mesh.** Reflections are
  computed there, so nothing outside it can appear in the water.
  `rainbowSample()` in `oceanSky.ts` does one ray-plane intersection for
  the view ray and one for the wave-reflected ray. The reflection
  therefore breaks up with the swell instead of being a flat mirrored
  copy. The arc's feet sit just below the waterline and are occluded by
  the sea in front of them (`tRainbow < tSea`).
- **The flight keeps going, 15% slower.** It's the one bonus round that
  doesn't pause. The rainbow is a fixed place in the world 100 units
  ahead, sized so it first looks as it would far out on the horizon,
  then grows on approach. The bird flies under the arch about 30s later.
  With true-to-life perspective (see "Horizon pitch" below), any arch
  grows out of the top of the frame once it's within about a third of
  its starting distance, whatever its scale. So the radius is kept to
  0.24× the distance, and the arch stays in view for about the first
  20s, the window a child has to answer.
  Flying under the arch is the only way the round ends
  (`onRainbowPassed`). Unanswered, it ends quietly.
- **The dash.** After the right answer, the bird dashes through the arch
  wherever it is:
  - speed eases to 6× (`RAINBOW_DASH_FACTOR`), at most about 5s from the
    farthest point;
  - the FOV kicks from 60° to 76°;
  - the rooster tail lengthens;
  - a whoosh plays on the dash and again at the arch;
  - the answer row celebrates for 1.5s, then fades out of the way.
- **Motion blur** (`MotionBlur.tsx`) is a zoom blur, 16 taps, sharp in
  the middle and streaking toward the edges. It takes over R3F's render
  loop (useFrame priority 1) but pays for the extra pass only while
  dashing; otherwise it's a plain `gl.render`. It deliberately doesn't
  use three's `EffectComposer`: its `OutputPass` would sRGB-encode the
  ocean shader's raw output a second time and wash out the sea.
  Rendering into a target tagged sRGB makes every material encode
  exactly as it does on screen. Because the bird kept moving, `endRainbowRound`
  re-anchors the held letter's cloud to the bird's live distance
  (`birdDistanceRef`) rather than the stale stashed one. The other
  rounds can reuse their stashed distance only because they freeze the
  flight.
- **Portrait phones** shrink the arc to fit the aspect ratio (bands
  shrink more gently), so both feet and their reflections stay on
  screen.
- **Drone camera.** While the rainbow is up, the chase cam blends
  (1.6s, smootherstep) to a shot above, behind and to the side of the
  bird, aimed 14 units ahead, and fades out the chase-cam roll so the
  drone holds level. The bird sits in open sky at lower-left with the
  rainbow ahead of it. The side offset shrinks on portrait screens so
  the bird stays in frame. The first framing tried (higher and wider)
  put the bird behind the answer swatches, caught by screenshot. Tuning
  constants are `DRONE_*` in `FlightScene.tsx`.
- **A child's rainbow, on purpose.** Six solid, crisp bands, red
  outside to purple inside, nearly opaque, with seams anti-aliased to
  about a pixel (`fwidth`) so they stay sharp up close and never shimmer
  far off. A physically based version was built and tried (Airy theory
  per wavelength, after J.A. Adam, *Physics Reports* 356, 2002). It
  showed secondary bow, supernumerary fringes, Alexander's dark band and
  CIE colour, and a "naive" paint blend was layered on top. In play it
  read as strange and washed out, so it was removed in favour of the
  drawing a child would make. Two useful findings if it's ever revisited:
  - big-drop showers (≈0.7 mm) give vivid colour where drizzle gives
    pastel;
  - light added onto a bright sky clips to white unless the sky behind
    the bow is dimmed (the rain curtain).
- **Albatross skim** (`SkimSplash.tsx`, `FlightScene`'s `SKIM_*`,
  `AlbatrossModel`'s `glideRef`):
  - **Flight:** while the rainbow is up, the bird swoops down (nose
    pitched into the dive) and locks its wings into a glide with only a
    slow flex. It banks ±18° in slow S-curves, so a wingtip clips the
    crests and throws spray.
  - **Belly-dips:** every 2–3.6s it does a comic belly-dip: a squash on
    impact, a crown of about 180 droplets plus a central plume, a foam
    ring, a synthesized `splash` sfx, and a hop back up past the skim
    line.
  - **Wake:** a continuous keel spray and a V of foam trail behind it.
  - **Heights:** the sea only exists in the shader, so heights come from
    sampling its wave function offline (mean ≈ 0.7, 90th-percentile
    crest ≈ 1.1, max ≈ 1.5). Per-wave tracking isn't possible anyway,
    because GPU float32 `sin()` differs from JS.
  - **Exit:** when the round ends, the bird climbs back and resumes
    flapping. The companion flock keeps some height rather than
    following it into the sea.
- **Horizon pitch (a long-standing shader quirk found here).** The
  ocean shader's `fromEuler()` applies pitch with the opposite sign to
  three.js; for the forward ray it yields `y = -sin(pitch)`. So the
  painted horizon has always been mirrored: the chase cam looks about
  10° down, and the horizon is drawn about 10° below centre instead of
  above. The whole game's framing was tuned on that look, so it's left
  alone by default. The drone shot blends `OceanSky`'s `truePitchRef`
  to 1, which is what makes the skimming bird visibly sit on the
  painted sea rather than floating above the horizon. Correcting it
  game-wide is an open question for the owner.
- **Demo shortcut.** Open the game with `?dev=true`, and **Alt+R**
  (Option+R on a Mac) queues a rainbow in front of the next letter.
  Plain R isn't used because typing R answers an R cloud. Without the
  parameter the shortcut does nothing.

Verified headlessly with the trigger temporarily forced: a wrong pick
shakes and doesn't break the streak; a right pick gives +2 stars and is
followed by the held letter's cloud; flying through unanswered ends the
round after ~21s and the held letter appears. Across 20,800 generated
rounds: 0 red+green pairs, 0 missing targets, and 0 R/O/Y/G/B/P letters
given the wrong colour.

## Live frame-rate calibration (Sep 2026)

This replaces the old fixed "touch device → low ocean tier + dpr 1"
decision. `AdaptiveQuality.tsx` measures fps in half-second windows and
nudges one 0–1 `quality` value, which drives these levers, top down
(`adaptiveQuality.ts`):

1. **Ocean supersampling** (quality 1 → 0.8): the sea renders at up to
   1.5x the canvas resolution (never beyond 2 rendered pixels per CSS
   pixel), smoothing the glints' shimmer. Only reached by climbing, on a
   machine with fps to spare: the "high def" sea for a strong PC.
2. **Ocean detail** (0.8 → 0.3): march steps 16→8, geometry waves 9→6,
   detail waves 20→10. These are **uniforms**
   (`uMarchSteps`/`uIterGeometry`/`uIterFragment`) that the loops break
   on, under the compiled ceilings. Counts are fractional, and the last
   wave's weight fades, so detail glides with no recompile hitch.
   `OceanSky` also eases toward the target.
3. **Ocean resolution** (0.3 → 0.12): the sea alone renders at down to
   half resolution and is upscaled, while the letters, bird and UI stay
   sharp. On a weak tablet this roughly halves the frame time before
   anything else has to blur.
4. **Canvas resolution** (below 0.12), in discrete steps because every
   change reallocates the canvas: native (≤2) → 1.5 → 1 → 0.75. The last
   resort, because it softens everything.

Levers 1 and 3 work by rendering the ocean into its own render target
and copying it to the screen with a plain textured quad (neither shader
converts colour spaces, so the copy is exact). At scale 1 the sea draws
straight to the screen as before. The scale is quantised to eighths, so
the target is reallocated only on a step change.

`?quality=0..1` in the URL pins the level and turns calibration off, for
comparing tiers on a real device: 1 supersampled, 0.8 full detail, 0.3
detail floor, 0.12 half-resolution sea.

Rules: under **40 fps** quality steps down fast (−0.08 per window, −0.15
under 30). At ≥55 fps sustained for 2s it creeps back up (+0.03 per
window, about 15s from floor to full). A level that caused a drop
becomes a ceiling for 20s, so it doesn't see-saw. Frames over 1s (tab
switch) are ignored. An earlier 0.25s cutoff froze calibration on a
device truly running at 3–4 fps, caught in a SwiftShader run. Touch
devices start at 0.42 (≈ the old low tier) and desktops at 0.8 (full
detail, not yet supersampled). In dev, `window.__flightQuality` shows
`{ fps, quality, dpr, oceanScale }`.

Verified in headless SwiftShader: a large window dropped to the floor
(quality 0, dpr 0.75). With the thresholds temporarily shifted to
exercise the climb, quality recovered, held at the ceiling for 20s,
then returned to full.

## Letter sounds, not just names (Sep 2026)

The flight game used to speak only letter NAMES ("bee"), although
`docs/02-pedagogy.md` puts letter SOUNDS first: sound-letter
correspondence is what predicts reading. That also made the CVC round
blend names ("see… ay… tee… cat"), which can't produce the word.

- **Letter voice setting** (grown-ups panel, `settings.letterVoice`):
  *Names*, *Sounds* or *Both*. *Both* (name, then sound) is the
  default, and tapping an option previews it on "B". Every letter the
  flight speaks goes through `sayLetter()` in `engine/audio.ts`: tapped
  clouds, replays, solves, the plane and look-alike prompts, and the
  rainbow's letter. So in *Sounds* mode the plane round becomes "hear
  /m/, find the letter".
- **The CVC round blends with sounds** ("kuh… ah… tuh… cat") unless the
  setting is *Names*. The whole word now follows the last letter's
  sound when it finishes, rather than on a fixed 350ms timer that cut
  off stretched sounds like "ssss".
- **Audio.** `speakLetterSound()` plays `/audio/sounds/<L>.wav` when
  present. Otherwise it speaks the spelled approximation from
  `data/letterSounds.ts` ("buh", "mmmm", short vowels "ah/eh/ih/aw/uh")
  through speech synthesis. `assets/generate-audio.mjs --only=sounds`
  generates the 26 clips from that same file, but they need a listen:
  verbatim TTS can only approximate an isolated sound. See
  `public/audio/sounds/README.md`.
- **Two audio fixes found while testing:**
  - A missing clip didn't 404. Vite's dev server, and most static hosts
    with a single-page-app fallback, return `index.html` (200,
    text/html), which the `<audio>` element sat on for the full 1.2s
    timeout. So every letter without a recording paused before being
    spoken. `playRecordedClip` now does one HEAD check per clip,
    checking the content type is `audio/*`, and falls back immediately:
    measured 36ms, was ~1.2s.
  - A speech call interrupted while it was still looking for its
    recorded clip used to fall through to synthesis anyway and talk
    over the newer call. A sequence counter (`speechSeq`) now cancels
    it, and cancels the second half of an interrupted name-then-sound.
- Verified in a headless browser against the real modules, with speech
  synthesis stubbed to record what's spoken: each mode says the right
  thing, recorded clips win over synthesis, the panel switches and
  persists the setting (older saved players default to *Both*), and a
  letter solved in flight in *Sounds* mode speaks its sound.
- Not changed: "Say it" speech recognition still listens for letter
  names, so a child answering with the sound won't match.

## Storm round: "which one starts with a different sound?" (Sep 2026)

Three picture cards hang in a sudden rain storm. Two start with the same
sound, and the child picks the odd one out. This is the classic
odd-one-out sound-categorization task (Bradley & Bryant 1983). It's
pure listening, with no reading needed.

- **Fair by construction** (`engine/oddSound.ts`, `data/initialSounds.ts`):
  - **Pairs are compared by first *sound*, not letter.** Every card was
    audited by hand. Cat/Cake/Car and Kite/Key/Kangaroo are all /k/;
    Queen/Quilt are /kw/; Unicorn is /y/; Xylophone is /z/; X-ray is
    /e/. A letter-based round could have asked "Cat, Car, Kite",
    which has no right answer.
  - **The pair previews the next letter:** it's two cards of the letter
    about to appear as a cloud.
  - **U and X never get a storm.** They can't make a fair pair, so the
    builder returns null and no storm comes that turn.
  - **The odd card never comes from a too-close sound**
    (`CONFUSABLE_SOUNDS`: b/p, d/t, m/n, e/i…).
  - Checked over 2,400 generated rounds: 0 unfair, 0 confusable odd
    cards, and every pair came from the target letter.
- **Flow:**
  - **Opening:** about a 20% chance per letter turn (`STORM_CHANCE`), as
    an interlude before that letter's cloud, like the other bonus rounds.
    The flight slows to 85% rather than pausing.
  - **Read-aloud:** the three cards are read aloud, then the question is
    asked. The banner's speaker replays it.
  - **Wrong pick:** the card shakes, the game explains ("Ball and Bear
    both start with… buh"), and there's no streak penalty. After 2
    misses the odd card glows as a hint.
  - **Right pick:** "Mouse… mmmm", +3 stars. The rain stops, the sky
    overshoots into a warm sunburst, and after 3.2s the held letter's
    cloud comes (re-anchored to the bird's live distance, as with the
    rainbow).
- **Weather** (`StormWeather.tsx`):
  - **Rain:** 900 streaks in a box that follows the camera.
  - **Sky and lights:** the ocean shader goes grey and dark (`uStorm`)
    and the scene lights dim too.
  - **Lightning:** every 3.5–7s. A jagged bolt far over the sea, a
    flickering full-frame flash (`uFlash`, which also lights the bird
    and cards), and soft synthesized thunder a beat later.
  - **Rain sound:** a synthesized loop (`sfx.startRain/stopRain`).
- **Cards** (`StormCards.tsx`) are held in view in front of the camera
  while the flight continues, scaled to fit a portrait phone, and placed
  in the top half, clear of the bird. They're positioned along the
  camera's axes rather than rotating a parent group, because
  `FlashCardSky` billboards itself and would be rotated twice.
- **Dev:** with `?dev=true`, **Alt+S** toggles a storm at will. It
  opens one immediately on the cloud in the sky (borrowing a B round
  for U/X) or clears the current one; with no cloud up, it queues one.
- **Two flash-card bugs found and fixed.** Both also affected the
  existing picture-choice round:
  - **Cards rendered invisible, or as a blank white panel.** The card
    SVGs have only a `viewBox`, and uploading them straight to WebGL
    came out blank. They also decoded at a blurry 125×150.
    `flashCardTexture.ts` now rasterises each SVG into a 512px canvas
    first.
  - **13 of the 72 cards embed their art as an external `.jpg`,** which
    browsers refuse to load inside an SVG-as-image, so those cards were
    blank. The references are now inlined as data URLs before
    rasterising.
  - The revealed card's aura, a flat coloured rectangle once the cards
    actually showed, is now a soft round glow.
- Verified headlessly with speech synthesis stubbed to record what's
  spoken. Tested: the read-aloud, wrong-pick feedback, right pick (+3
  stars), the storm ending and the held letter returning, and the dev
  toggle (open, clear, cloud back), on desktop and phone viewports.

## Storm Vowels, focus letters, and the "My Name" flight (Sep 2026)

**Storm Vowels** (`engine/vowelRound.ts`, `data/vowelWords.ts`,
`components/VowelStorm.tsx`) asks "C _ T: which sound is missing?". The
middle short vowel is the hardest part of a CVC word for beginners,
especially English learners.
- **Scheduling:** it takes half of the CVC cadence's turns
  (`VOWEL_STORM_SHARE`); the other half stay the catch-in-order word
  round.
- **Words:** 17 CVC words covering all five short vowels. Nine have
  flash-card pictures, and none exist for short e, so the round says the
  word first ("van… Which sound is missing?") and works as a listening
  task either way.
- **UI:** the word board and three falling vowel raindrops are DOM, not
  3D, so the letters stay crisp and the drops are big tap targets. The
  drops fall below the board so one never covers the gap. The storm
  weather around them is the same 3D storm, now driven by a shared
  `weather` prop.
- **Wrong drop:** plays its sound, then "Listen: van", with no streak
  penalty. After 2 misses the right drop glows.
- **Right drop:** a lightning bolt strikes dead ahead (`strikeKey`) with
  near-instant thunder, and the word flashes gold. It's blended sound by
  sound (per the Letter Voice setting), then said whole, for +4 stars.
- Dev: **Alt+V** toggles one with `?dev=true`.

**Focus letters** (grown-ups panel, `settings.focusLetters`): an A–Z
chip grid.
- **Classic:** focus letters fill half of each flight (`FOCUS_SHARE`),
  including letters beyond the child's current curriculum pool, since a
  grown-up picked them on purpose. They repeat when there are fewer
  focus letters than slots, and are spread so the same letter never
  appears twice in a row.
- **Endless/Sprint:** each letter has a 50% chance of coming from the
  focus letters.
- The intro shows "· focus B D" as a reminder.

**"My Name" flight**, a fourth mode:
- **Flight:** the letters of the child's first name, in order, in the
  case they're written (Mia → M, i, a). There are no bonus interruptions,
  since it's a spelling.
- **Top bar:** shows the whole name from take-off, faint until each
  letter is caught.
- **Landing:** "You flew your name!". The name pops in letter by letter
  while the game spells it aloud with letter NAMES, the way names are
  spelled, then says the name.
- **Non-English names:** non-English letters are skipped, and a name
  with none (e.g. written in Hebrew) disables the mode with an
  explanation. It uses Classic's day arc.

Verified in a headless browser:
- 2,000 generated vowel rounds, all valid, with no back-to-back repeats.
- Focus letters are exactly 50% of Classic flights, with 0 same-letter
  neighbours.
- Name parsing ("Noa נועה" → Noa; Hebrew-only → disabled).
- A Storm Vowels round end to end: board, wrong and right drops, the
  blend, +4 stars and the held letter returning, on desktop and phone.
- A full "Mia" flight to the end screen.
- The focus card saves and shows in the intro.

## "My Nest": the kids' own progress screen (Sep 2026)

Everything the grown-ups' dashboard says in numbers, told as a picture a
5-year-old can read (`screens/Nest.tsx`). It opens with one tap (no
hold): "My nest" under Take Off!, and "See my nest" on the landing
screen, which reads "See my new chicks!" when letters were mastered that
flight.

- **The egg nest (hero).** All 26 letters are eggs in a woven bowl with
  twigs along its rim:
  - **resting:** faint, not met yet;
  - **warming:** being practised; speckled, cracked, rocking now and
    then;
  - **hatched:** mastered; a chick sitting in the bottom half of its
    shell, holding its letter.
- **Hatching on arrival.** Letters mastered since the last visit
  (`PlayerState.nestSeen`) hatch in turn: a hard shake, the shell top
  flies off, the chick pops out with a sparkle burst and a pop. It's
  capped at 6 per visit (a first visit could owe 20); the rest are
  already chicks.
- **The screen talks.** After the hatching it speaks a summary built
  from the real state, e.g. "You've hatched 9 letters! New chicks: M, S
  and T! 1 more and a butterfly joins your flock!". The speaker button
  replays it.
- **Tap an egg or chick:** an egg-shaped card with the letter in both
  cases, a picture word, and a gentle status line. It says the letter
  (per the Letter Voice setting), then the word.
- **Keepsakes:**
  - **Star jar:** fills 100 stars to a jar, and full jars go on a little
    shelf. The count animates up.
  - **Flock:** the companions who've joined, plus the next one as a grey
    silhouette with dots to go. The companion specs moved to
    `data/companions.ts`, shared with the 3D flock.
  - **The last 7 days as suns:** bright and smiling for a day flown,
    pale and sleepy for a day off.
- **Deliberately absent:** accuracy, "needs practice" and red. A child's
  report only ever shows growth, and letters in progress are eggs
  getting ready to hatch, never failures.
- **Look:** golden hour over the nest (sky blue to warm peach, twig
  browns, shell cream, chick yellow) in Baloo 2. The hatching is the one
  bold motion; `prefers-reduced-motion` shows everything already
  hatched, with no wobble.
- Verified headlessly with a seeded player (9 mastered, 3 of them new, 6
  in progress, 137 stars, 4 days flown): the sequential hatch, the
  spoken summary, `nestSeen` saved (so they don't re-hatch), the tap-M
  card ("Em… mmmm… Moon"), on desktop and phone.

## Sea shimmer at top quality, and a Milky Way at night (Sep 2026)

Both live inside the ocean shader (`oceanSky.ts`), so no extra passes.

**Sea shimmer (quality 1.0 only).** A new `uShimmer` uniform, which
`OceanSky` eases 0↔1 over 1.5s whenever the calibration level is exactly 1
(top of the supersampling band). Standalone previews without a `qualityRef` count as 1. It adds two things to `shadeSea`:

- **Bloom:** a soft halo around the sun's or moon's glitter path, so it
  reads as a glowing road. It's a wide glint lobe taken off a *flat*
  surface with the sea's overall roughness, not off the pixel's normal.
  The normal-based version was tried first. Through a lobe that wide, the
  exp-sine waves' sharp crests showed as a visible crosshatch (found in a
  debug render that output only the halo term).
- **Sparkles:** one blinking point per surface cell, lit only inside that
  halo. Cell size follows the pixel footprint in cross-faded powers of
  two, so a sparkle stays a few pixels wide from near the bird out to
  the horizon.

**Milky Way.** A band along a fixed great circle (`GALAXY_POLE`) in
`skyColor`, direct view only, not reflected. It has fbm cloud structure,
a dark dust lane, a blue/rose tint, a denser layer of faint stars, and a
slow shimmer. It rises from the horizon just left of dead ahead and leans
left, so it shows on portrait phones too and stays at least ~30° from the
moon through the evening (the angle was checked numerically against
`moonDirection()` at 19h–24h). It fades in with `night²`, so it arrives
later than the plain stars. It's dimmed near the horizon haze and in the
moon's glare, and it scales with `uStarIntensity`.

**Coloured, independently twinkling stars.** The stars used to look
painted on. Each one took its twinkle rate from the same hash that
decides whether a cell has a star at all. That hash only passes above
0.9965, so every star's rate fell into the same narrow range and they
all pulsed together. `starLight()` now gives each star three seeds of its
own:
- **Colour:** a star-temperature tint (blue-white, white, gold, orange,
  or the odd rosy red).
- **Rate:** anywhere from 0.3 to 4 radians per second.
- **Twinkle:** two unrelated sine waves, so no star repeats a simple
  beat.

The Milky Way's faint stars use it too.

Verified with a temporary harness page that mounted the real `OceanSky`
with a fixed camera in the game's chase pose. It was rendered headlessly
at 9h/18h/20.5h/22h, quality 1 vs 0.9, in landscape (960×540) and
portrait (390×844), with magnified crops of the glitter path. `npm run
build` and `npm run lint` are clean (only the lint warnings that were
already there).

## Letter sounds off until recorded, wider picture cards, shooting stars

- **Letter sounds.** Speech synthesis can't say an isolated sound: the
  spelled approximations in `data/letterSounds.ts` came out as "ef ef ef"
  and "es es es". `speakLetterSound` now plays only a recorded clip from
  `public/audio/sounds/`. With no clip it says the letter's name instead,
  so the word, storm and Storm Vowels rounds still voice the letter.
  `sayLetter(…, 'both')` stops after the name when there's no clip, so the
  name isn't said twice. The Dashboard's Letter Voice card says so. Once
  `generate-audio.mjs --only=sounds` has produced clips, sounds come back
  with no code change.
- **Picture-choice cards** sit a little further from the letter cloud:
  flanks at ±7.6 (was ±6.8), crown at +5.5 (was +4.8). The cards'
  generous hit proxies were reaching the letter's, so a tap meant for a
  picture could land on the letter.
- **Shooting stars** (`shootingStar()` in `oceanSky.ts`). They're drawn in
  the sky shader, beside the stars and Milky Way, and fade in with them.
  The schedule is pure hashing on `iTime`: 9-second slots, two in five
  get a 0.9 s meteor, which works out to about one every 20 s of night.
  Each meteor starts within ~45° of straight ahead, 9–26° up, and falls
  sideways and down.

Verified headlessly. A scratch page rendered the real fragment shader at
23h with the game's fov and a slight downward pitch, and screenshots were
taken at meteor times found with a JS mirror of the shader hash (streak
and head clearly visible, well framed). The audio functions were checked
in the browser with `speechSynthesis` and `HTMLMediaElement.play`
stubbed: `speakLetterSound('F')` plays `letters/F.wav`,
`sayLetter('S','both')` says just "Ess", and nothing reaches synthesis
as a sound spelling. `npm run build` and lint are clean.

## Not yet built

- The STL has no color/material data — the flap animation is real
  (see "The bird model" above), but there's no rig, so there's no
  subtler per-feather or body-flex motion a real GLB rig could give.
- Letter-cloud altitude variety is still minimal (the route weave and
  random `laneX` vary the lateral position; height doesn't move) —
  fine since only one is ever visible at a time, but more variety would
  read as more alive.
- ~~The dev bundle is ~1.2MB~~ — addressed in the polish pass: the
  whole three.js/R3F/drei stack now lives behind `three/FlightCanvas.tsx`,
  loaded with a dynamic `import()` that FlightGameScreen kicks off (and
  preloads the bird mesh through) while the child is still on the
  intro. The first chunk is the DOM screens only.
- No numeric mission-timer readout in the HUD — deliberate (the sky
  itself is the timer, diegetically), but worth knowing it was a choice
  and not an oversight if it turns out kids want a countdown.
- Picture-choice bonus only fires for letters with a real illustrated
  word (today: A-F, per docs/08-asset-pipeline.md's icon-coverage gap)
  — as more letters get real illustrations in `WordIcons.tsx`,
  `engine/pictureChoice.ts` picks them up automatically, no code change
  needed here.
