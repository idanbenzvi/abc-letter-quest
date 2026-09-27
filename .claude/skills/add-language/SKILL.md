---
name: add-language
description: Add a new learning language to ABCtross (Hebrew, Arabic, Japanese, Russian, Korean, Spanish, …) — letters, names and sounds, words and flash cards, stroke order, round content, spoken phrases, fonts, audio, and the app wiring. Use when asked to support, add, translate or localize the game into another language or alphabet, to create or extend a language pack, or to make the game teach non-English letters.
---

# Add a language to ABCtross

You are adding a language the game will **teach to a 4–6 year old**. Quality
bar: every letter, word, picture, sound and stroke must be right, because a
child will learn it. You can research, draft, generate and test; **only a
native speaker can approve** (see step 9). Never mark a pack `reviewed`
yourself.

Read before starting (in this order, fully):
1. `docs/11-languages.md` — the pack system, files, scripts, validation rules, Phase 0.
2. `docs/languages/README.md` — how to author content well.
3. The script guide: `docs/languages/hebrew.md`, `arabic.md`, `japanese.md`,
   or `other-scripts.md` (Russian, Korean, Latin-alphabet languages, others).
4. `CLAUDE.md` (repo root) — commands, headless testing, architecture.

## 0. Branch

Never work on `master`. From the repo root:

```bash
git switch -c lang/<code>        # e.g. lang/he
```

(Or a worktree: `git worktree add ../abc-letter-quest-<code> -b lang/<code>` and
symlink `app/node_modules` + `assets/node_modules` from the main checkout.)
Commit in small steps with clear messages. Push/open a PR only when the user asks.

## 1. Is Phase 0 done?

Phase 0 is the one-time refactor that makes the **game read language packs**
(`docs/11-languages.md#phase-0-making-the-game-read-packs`). Check:

```bash
ls app/src/lang/index.ts 2>/dev/null && echo "runtime exists"
node app/scripts/lang/audit.mjs --summary
```

- **Runtime exists and the audit shows only `english-only-feature` hits** →
  Phase 0 is done; continue with step 2.
- **Otherwise** → the new language can be fully authored and built (steps
  2–8 work without Phase 0), but it can't be played yet. Tell the user,
  and ask whether to do Phase 0 now. If yes: do it on its **own** branch
  (`lang/phase-0`, from master) following the doc's 10 steps in order, with
  the acceptance checklist at the end; then rebase the language branch on it.

## 2. Scaffold

```bash
node app/scripts/lang/new-language.mjs --list                      # pick a profile
node app/scripts/lang/new-language.mjs <code> --profile=<profile>  # e.g. he --profile=hebrew
node app/scripts/lang/validate.mjs <code>                          # errors = your to-do list
```

No fitting profile → follow `docs/languages/README.md#new-script` first.
The scaffold creates `app/languages/<code>/pack.json`, `strokes.mjs`,
`NOTES.md`. Profiles prefill facts (letters, names, forms, fonts, locales,
look-alikes, colour words); everything needing judgement is `TODO`.

## 3. Research → NOTES.md

Answer the five research questions in `docs/languages/README.md#research-first`
and fill NOTES.md's **Sources** and **Decisions** before writing content.
Use primary sources (ministry curricula, teacher guides, children's
dictionaries); use web search/fetch for them. Record which variant, locale
and register you chose and why.

## 4. Author the pack (`app/languages/<code>/pack.json`)

Work in this order, validating after each:

1. **Letters** — review prefilled names/aliases/IPA/notes; write every
   `sound` (or `null`) per the script guide; set `keys` only if needed.
2. **Forms** — confirm `forms.model`, labels, `introduceSecondaryFromBox`.
3. **Curriculum and chapters** — teaching order per
   `README.md#curriculum` (look-alikes apart, frequent letters first) and
   4–6 warmly named chapters whose sizes sum to the letter count.
4. **Words** — 3+ per letter, per `README.md#words`: known to a 4–6 year
   old, picturable, starting with the letter's taught sound, written as
   beginner books write them (vowel marks!), `initialSound` keyed by what's
   heard, `art` reusing existing pictures (`ls app/public/art/flashcards/*.jpg`)
   when the meaning matches, English `gloss`. The script guide has starter
   candidates — they still need verification.
5. **Sounds** — `confusableSounds` pairs.
6. **Look-alikes** — confirm the prefilled pairs and `lookAlikeForm`.
7. **Rounds** — blend words, missing-piece design, rainbow colour words
   (add vowel marks), odd-sound/plane flags. Turn a round **off** (null) if
   it wouldn't teach reading in this language.
8. **Phrases** — every English key, natural warm register, all
   `{placeholders}`, all plural categories for the language.
9. **Features** — handwritingCheck is always false; typing off for IME scripts.

Loop until clean:

```bash
node app/scripts/lang/validate.mjs <code>          # 0 errors required
```

Every remaining **warning** must be fixed or explained under
"Known warnings" in NOTES.md.

## 5. Strokes (`app/languages/<code>/strokes.mjs`)

Every `char` and `secondary` needs strokes: one path per pen stroke, in
teaching order and direction, authored with the kit (`app/scripts/lang/stroke-kit.mjs`).
**Never copy stroke data** from KanjiVG or any other dataset/font (license);
use sources only to learn the order, cite them in NOTES.md.

```bash
node app/scripts/lang/build-strokes.mjs <code> --preview
```

Then LOOK at every letter in `app/scripts/lang/out/<code>-strokes.html`
(headless: Playwright, wait for `body[data-ready]`, screenshot, read the
image). Strokes must sit on the grey glyph's centreline, start where the
number is, run the right way. Fix and repeat until every letter is right.
Don't skip letters and don't guess an order you haven't sourced.

## 6. Build, cards and pictures

```bash
node app/scripts/lang/build.mjs <code>             # strokes + cards + pack.generated.ts + review sheet
cd app && npx tsc -b && npm run lint               # generated modules must typecheck
```

Words without a picture are listed; follow `docs/languages/README.md#pictures`
(review prompts in `out/<code>-art-manifest.json`, merge into
`assets/manifest.json`, `node assets/generate.mjs --only=word-<id>`, look at
the result, save as `app/public/art/flashcards/<id>.jpg` 1024×1024, set
`art`). Generating costs money/quota — ask the user before large runs.
Pictures must contain no text.

## 7. Audio

```bash
cd assets && node generate-language-audio.mjs --lang=<code> --dry-run
```

Read every line of the dry run: the TTS reads text **verbatim**, so fix any
spelling that could be misread (add vowel marks) in pack.json first. Then
ask the user before generating (needs `GEMINI_API_KEY`; ~10 clips/day on the
free tier, a language is 150–300 clips). Rerun until complete (existing
clips are skipped).

## 8. Interface strings and wiring (needs Phase 0)

- `app/languages/<code>/ui.json`: translate every key of `app/languages/en/ui.json`
  (Phase 0 creates it), same `{placeholders}`, plural objects where English has them.
- Register the pack if the runtime doesn't pick it up automatically.
- Test in the real app, headless (see `CLAUDE.md`): `?lang=<code>` plus a
  seeded player; play a full flight; trigger each round with the dev keys
  (`?dev=true`: Alt+R rainbow, Alt+S storm, Alt+V missing piece); check the
  writing page, the Nest, the Dashboard; RTL layout for RTL scripts; no
  console errors. Screenshot and look.
- Append a section to `docs/10-flight-game.md` saying what was added and verified.

## 9. Native-speaker review

`node app/scripts/lang/build.mjs <code>` regenerates
`app/scripts/lang/out/<code>-review.html` (letters, words with pictures,
rounds, phrases, audio players) and `<code>-strokes.html`. Tell the user a
native speaker must go through both (and listen to every clip). Apply
their corrections, log the review in NOTES.md's table, and only then — with
the user's confirmation that the review happened — set `"status": "reviewed"`.

## Rules

- **Stable ids**: letter/word ids are storage keys and file names. Never
  rename one after it has shipped.
- **Vowel marks everywhere a beginner sees or TTS reads text** (Hebrew
  niqqud, Arabic harakat).
- **Sounds, not letters** decide `initialSound`.
- **No copied content** with incompatible licenses (stroke datasets,
  illustrations, word lists as creative works). Facts are fine.
- **Kid-facing text shows growth only** — no scores, no "wrong", no red
  (CLAUDE.md content rules).
- **Don't hand-edit generated files** (`*.generated.ts`, card SVGs): change
  the source and rebuild.
- **English pack**: if you change English data files, rerun
  `node app/scripts/lang/extract-english-pack.mjs` (CI-style check: `--check`).
- Report honestly: what's done, what's drafted but unverified, what needs
  the reviewer, what failed.
