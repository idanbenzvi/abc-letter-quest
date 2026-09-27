# Language packs — authored source

One folder per language the game can teach: `pack.json` (letters, words,
rounds, phrases, fonts, locales), `strokes.mjs` (stroke order) and
`NOTES.md` (sources, decisions, native-speaker review log).

- `en/` is extracted from the English data files — don't edit it by hand;
  run `node app/scripts/lang/extract-english-pack.mjs`.
- Add a language with the `add-language` skill
  (`.claude/skills/add-language/SKILL.md`); the design is in
  `docs/11-languages.md`.
