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

Ported (MIT-adjacent, see attribution comment in `oceanSky.ts`) from
the CodePen the user linked ("Oceanara" by Julibe,
https://codepen.io/Julibe/pen/GgjjpeB), whose core is itself the
classic "Seascape" raymarched shader by TDM
(https://www.shadertoy.com/view/Ms2SD1) — a widely-taught reference
technique, not proprietary to the CodePen author. This is a
**fullscreen fragment shader**, not real 3D geometry: a 2-triangle quad
raymarches an implicit-height-field ocean and a procedural sky
(day/sunset/night blend, sun, moon, stars) per pixel, driven entirely
by uniforms. Trimmed from the original: removed the demo's reflective
beach-ball + its physics, GSAP-tweened sidebar, and mouse-drag camera —
kept exactly the sky+ocean raymarch.

**Camera sync architecture** (the actual integration challenge, since
a fullscreen shader has no real 3D camera of its own): `OceanSky`
reads the scene's **real** Three.js camera every frame and feeds its
live position/rotation/fov in as the shader's uniforms, rather than
letting the shader drive an independent implicit camera as the original
demo did. The real camera is the single source of truth — real 3D
objects (bird, letter-clouds) and the painted backdrop are guaranteed
to agree on where "here" is because they're reading the same camera.
Rotation sync is an approximation (shader's hand-rolled `fromEuler()`
isn't proven equivalent to Three's Euler convention) — acceptable
because the flight only ever banks the camera gently.

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
