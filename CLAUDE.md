# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ABCtross (package/repo name "ABC Letter Quest"): an ABC and early-reading game for a 4–6 year old
learning English as a second language. The core gameplay is a 3D albatross flight over a
raymarched ocean, where letters appear as clouds and bonus rounds (rainbow, storms, word
rounds) interleave. Local-only: no backend, and progress lives in `localStorage`.

- `app/`: the Vite + React 19 + TypeScript app (React Three Fiber for 3D). All real work is here.
- `assets/`: AI asset pipelines (Gemini): `generate.mjs` (art) and `generate-audio.mjs` (TTS clips).
- `docs/`: design docs. Read `docs/README.md` for the order. **`docs/10-flight-game.md` is the
  running design log for everything in the flight game.** Append a section when you add or
  change a feature there, including what was verified and how.
- `design/`: static mockup canvas (visual pitch only).

## Commands

All from `app/`:

```bash
npm run dev          # Vite dev server: HTTPS-only (basic-ssl), needed for camera/mic APIs
npm run build        # tsc -b && vite build (the real type check)
npm run lint         # eslint
npx tsc -b           # type check only
```

There is **no test runner**. Verification is done by driving the real app headlessly:

- Port 5173 is often taken by another project on this machine, so run
  `npx vite --port 5199 --strictPort` and use `https://localhost:5199` (self-signed: Playwright
  needs `ignoreHTTPSErrors: true`).
- No Playwright in the repo. Install `playwright-core` in a scratch dir and launch the cached
  Chromium at `~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome` with
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` so WebGL renders.
  SwiftShader is slow: wait on conditions, not fixed timeouts.
- **Unit-style checks:** `page.evaluate(() => import('/src/engine/whatever.ts'))` calls real modules
  in the browser against the dev server. Use this for engines/builders (e.g. generate 1000s of
  rounds and assert invariants).
- **Game state:** seed a player by writing `localStorage['abc-letter-quest:v1']` (shape in
  `src/types.ts` `AppState`), then reload.
- **Hooks for automation:**
  - `.flight-game` carries `data-encounter-letter`, `data-encounter-status`,
    `data-storm-cards` and `data-storm-odd`.
  - Typing a letter solves the cloud showing it.
  - Stub `window.speechSynthesis` in an init script to record what the game says.
- **Dev URL params:**
  - `?dev=true` enables Alt+R (rainbow next), Alt+S (storm round toggle) and Alt+V (Storm Vowels
    toggle).
  - The backtick key opens the ocean/sky tuning panel mid-flight.
  - `?rig` opens the albatross rigging tool.

Audio generation (from `assets/`, needs `GEMINI_API_KEY` in `assets/.env`, free tier ≈10
clips/day, skips existing files): `node generate-audio.mjs --dry-run | --only=letters|sounds|words|<id>`.

## Architecture (the parts that span files)

**App shell.** `App.tsx` is a plain view switch (no router): onboarding, player select,
`play` (FlightGameScreen), `dashboard` (grown-ups) and `nest` (kids' progress). World Map /
LetterLearning / Celebration screens still exist but are unrouted legacy.

**State.** One `useReducer` in `state/AppContext.tsx`, holding multiple players. Every screen
reads the active player as `state`. It's persisted as one JSON blob (`engine/storage.ts`),
and `withSettingsDefaults` merges new settings into old saves. Adding a grown-up setting
therefore means:
- a field and its doc in `types.ts` `Settings`,
- a default in `storage.ts`,
- a reducer action and setter in `AppContext`,
- a card in `screens/Dashboard.tsx`.

**Flight game split.**
- `three/FlightGameScreen.tsx` owns React/game state, all round logic, speech, scoring and the
  DOM HUD.
- `three/FlightScene.tsx` owns the R3F tree and everything per-frame: mission clock, bird and
  camera, speed, weather easing.
- `three/FlightCanvas.tsx` is the lazily imported boundary that keeps three.js out of the first
  chunk.
- Communication runs through props and refs (`qualityRef`, `birdDistanceRef`), never React state
  updated per frame.

**Bonus rounds are interludes, never replacements.**
- `presentItem()` in FlightGameScreen is the *only* place a queue letter is presented and a
  bonus round rolled.
- Every round stashes the letter in `pendingPresentRef`, and `resumeAfterSpecialRound()` then
  shows that letter's real cloud: at most one interlude per letter.
- Rounds that pause the flight (plane, matchup, CVC) reuse the stashed spawn distance. Rounds
  that only slow it (rainbow, storm, Storm Vowels) must re-anchor to `birdDistanceRef` when they
  end.
- The "My Name" mode bypasses all interludes.

**The ocean is a fullscreen raymarched shader** (`three/oceanSky.ts` + `OceanSky.tsx`),
rendered first with no depth; real 3D objects draw over it.
- **Reflections:** anything that must reflect in the water (the rainbow) has to be computed
  *inside* that shader.
- **Weather and detail:** storm tint and lightning flash are shader uniforms. Wave and march
  detail are uniforms driven live by `AdaptiveQuality.tsx` (fps-based calibration), so don't
  reintroduce compile-time quality tiers.
- **Mirrored horizon:** the shader's `fromEuler()` applies pitch with the opposite sign to
  three.js, so the painted horizon is mirrored relative to 3D geometry. The whole game's
  framing was tuned on that, so it is left as-is by default. `truePitchRef` blends in the
  correct pitch only for the rainbow's drone shot.

**Rendering loop.**
- `three/MotionBlur.tsx` takes over R3F's render loop (`useFrame` priority 1) and renders
  directly unless the rainbow dash is blurring. Keep all other `useFrame` hooks at priority 0.
- Don't use three's `EffectComposer`/`OutputPass`: it double-encodes the ocean shader's raw
  output.

**Flash-card textures** (`three/flashCardTexture.ts`):
- Card SVGs have only a `viewBox`, and 13 embed external `.jpg` art. Loading them with
  `TextureLoader` or a plain `<img>` renders blank.
- Always go through `getFlashCardTexture` (3D) or `getFlashCardImageUrl` (DOM). These inline
  the images and rasterise via canvas.

**Audio** (`engine/audio.ts`):
- **Functions:** `speak()` (names and words), `speakLetterSound()` (/b/-style sounds from
  `data/letterSounds.ts`) and `sayLetter(letter, settings.letterVoice)`. Use `sayLetter` for any
  letter the child hears.
- **Clips:** recorded clips in `public/audio/{letters,sounds,words}/` win over speech
  synthesis. A HEAD content-type probe detects missing clips, because the dev server returns
  `index.html` for them.
- **Interruptions:** multi-part utterances check `speechSeq`, so a newer tap cancels the rest.
- **Sound effects:** synthesized in `engine/sfx.ts` (no audio assets).

**Content rules the code relies on:**
- **Sound, not letter:** odd-one-out rounds compare first *sounds*
  (`data/initialSounds.ts`, hand-audited: Cat/Kite are both /k/, Xylophone is /z/), not
  letters. Keep new cards consistent.
- **Kid-facing screens show growth only:** no scores, no red, no "needs practice". Numbers and
  weak spots belong in the grown-ups Dashboard.
- **Serve reading:** every new bonus round should serve reading (see `docs/02-pedagogy.md`),
  not just be a mini-game.
