# Asset pipeline

Full detail lives in `assets/README.md`, `assets/STYLE_GUIDE.md`, and
`assets/manifest.json` — this doc is just the pointer + how it relates
to the app.

## Summary

- Provider: Google Gemini API — Nano Banana Pro
  (`gemini-3-pro-image-preview`) for Buddy's mascot poses, where
  character consistency across many images matters most; Nano Banana 2
  (`gemini-3.1-flash-image`) for the cheaper, simpler word-illustration
  icons.
- Nothing has been generated yet — `assets/generate.mjs --dry-run` has
  been verified to compose correct prompts, but no API key has been
  configured and no real generation run has happened.
- Bootstrap flow: generate Buddy once with no reference, approve him,
  save that image as the character reference, then generate every other
  Buddy pose and word icon against that reference for style/character
  consistency.

## Relationship to the app

The app (`app/`) currently ships with **hand-built inline SVG icons**
for the words it implements (see `app/src/components/icons/WordIcons.tsx`),
in the same flat-vector style described in
`assets/STYLE_GUIDE.md`. These are real, finished icons, not
placeholders to be embarrassed about — but they don't scale to the full
26-letter word list by hand at the same quality bar, which is the actual
reason the AI pipeline exists.

When generated art is approved:
1. Drop the approved PNGs into `app/public/art/` (or similar — not yet
   created, add it when this actually happens).
2. Swap the relevant icon component from inline SVG to an `<img>` tag.
3. Extend `app/src/data/words.ts` with the remaining letters as their
   icons become available, rather than blocking the whole word list on
   every letter being generated at once.
