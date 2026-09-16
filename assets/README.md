# Asset generation pipeline

Generates Buddy's mascot poses and the word-illustration set for ABC Letter
Quest using the Gemini API (Nano Banana Pro / Nano Banana 2), styled from
`STYLE_GUIDE.md` and listed in `manifest.json`. Nothing here has been run
yet — this is the pipeline configured and ready for whenever you want to
spend the API budget and actually generate art.

## Setup

```bash
cd assets
npm install
cp .env.example .env   # then paste in a key from https://aistudio.google.com/apikey
```

## Preview prompts for free first

```bash
npm run dry-run
```

Prints exactly what would be sent to the API for every asset in the
manifest — no key needed, no cost. Read through these before spending
anything; tune wording in `manifest.json` / `STYLE_GUIDE.md` if something
reads off.

## Bootstrap Buddy's reference image

Character consistency depends on generating Buddy once, approving him, then
feeding that image back in as a reference for every other pose. So the
first real run should be just him:

```bash
node generate.mjs --only=buddy-standing-wave
```

Open `generated/buddy-standing-wave.png`. If he looks right, copy it into
the reference slot:

```bash
cp generated/buddy-standing-wave.png reference/buddy-model-sheet.png
```

If he doesn't look right, tweak his description in `STYLE_GUIDE.md` under
"Buddy the fox — character model sheet" and re-run until he does — don't
lock in a reference you're not happy with, every later pose inherits it.

## Generate everything else

```bash
node generate.mjs --only=mascot              # remaining Buddy poses
node generate.mjs --only=word-illustration    # word icons
node generate.mjs                             # or just run the whole manifest
```

Output lands in `generated/<asset-id>.png`. Nothing is overwritten
automatically — re-running an id just overwrites that one file.

## Extending the manifest

The starter manifest only covers Buddy's core poses plus the words for
letters A–F (matching what's already in the design canvas). Before a full
production run, extend `manifest.json`'s `assets[]` array with one entry
per remaining letter/word using the same shape:

```json
{
  "id": "word-<word>",
  "category": "word-illustration",
  "tier": "flash",
  "usesReference": "buddy",
  "aspectRatio": "1:1",
  "word": "<word>",
  "letter": "<LETTER>",
  "prompt": "A single ... , simple flat icon illustration, centered."
}
```

(`usesReference: "buddy"` here just keeps the *style* consistent, not
Buddy's likeness — the reference nudges the model toward the same
flat-vector rendering approach rather than drifting style between
objects. Drop it if a given word's illustration ends up looking too
fox-flavored.)

For the real game you'll eventually want 2-4 word options per letter (the
spaced-repetition scheduler needs variety so a mastered letter doesn't
always show the same word) — the manifest shape supports that already,
just add more entries with the same `letter`.

## Cost awareness

Nano Banana Pro (`tier: "pro"`, used for mascot poses) was $0.134/image at
GA pricing in June 2026 — check https://ai.google.dev/pricing for current
numbers before a big run, and prefer `tier: "flash"` (Nano Banana 2) for
the word-illustration set once Buddy's style is locked; it's meant for
exactly this kind of simpler single-object generation and is meaningfully
cheaper. `--dry-run` costs nothing and is the way to sanity-check a large
batch before running it for real.

## Using the output in the app

These PNGs are meant to replace the placeholder inline-SVG shapes in the
design canvas once the real app is being built — drop approved images into
the app's asset folder and swap the `<svg>` mockup blocks for `<img>` tags
pointing at them. Nothing in the design canvas itself needs to change for
this to work later.
