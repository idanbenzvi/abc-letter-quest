# Authoring a language

How to fill a language pack well. The pack format and tooling are in
[`docs/11-languages.md`](../11-languages.md); the step-by-step workflow is
the `add-language` skill (`.claude/skills/add-language/SKILL.md`). This
guide is about **content**: getting the letters, sounds, words and rounds
right for a 4–6 year old, in any script. Read the matching script guide
next: [Hebrew](hebrew.md), [Arabic](arabic.md), [Japanese](japanese.md),
[other scripts](other-scripts.md).

The game's teaching principles ([`docs/02-pedagogy.md`](../02-pedagogy.md))
apply unchanged: sounds before names, dual coding (word + picture),
multisensory tracing, spaced repetition, errorless-leaning feedback, and
kid-facing screens that show growth only.

**The golden rule:** everything a child sees or hears must be checked by a
native speaker before the pack's `status` becomes `"reviewed"`. You can
research, draft and generate; you cannot sign off. Record every review in
the pack's `NOTES.md`.

---

## Research first

Before writing any content, spend the time to answer these in `NOTES.md`
(with sources):

1. How do children in that language actually learn to read? (Kindergarten
   / first-grade curriculum, the order letters are introduced, what
   "a letter's sound" means to a teacher there.)
2. Which script variant do young children read? (Hebrew with niqqud;
   Arabic with harakat; Japanese hiragana before katakana and kanji.)
3. Which form do they WRITE first, and in what stroke order? (Israeli
   children read print but learn cursive handwriting; Japanese stroke order
   is standardised and strictly taught.)
4. Which dialect/register and which TTS/speech-recognition locale?
5. Which letters are silent, have several sounds, or never start a word?

Use primary sources (ministry of education curricula, teacher guides,
children's dictionaries). Don't trust a single web page for stroke order or
letter names. **Never copy content from a source whose license doesn't
allow it** (see [strokes](#strokes)); facts (the letter list, names, sounds)
are fine to use, specific creative works (someone's word list layout,
stroke datasets, illustrations) are not.

---

## Letters

<a id="names"></a>
**`name`** — the letter's name as TTS input, in the target script, spelled
so a voice reads it correctly. Add vowel marks where the script has them
(Hebrew `בֵּית`, not `בית`) because the TTS model reads verbatim. For kana
the name is the kana itself.

**`nameAliases`** — what a speech recogniser might return when a child says
the name: the bare letter, the name with and without vowel marks, common
misspellings, homophones. Japanese recognisers often return kanji for a
lone syllable (saying "ka" can come back as 蚊 or 課); list the likely ones.
Aliases are compared case-folded and NFC-normalised.

<a id="sounds"></a>
**`sound`** — the letter's most common sound, spelled for TTS, or `null`.
This is what "Letter voice: sounds" plays and what the missing-piece and
odd-one-out rounds lean on. Principles:
- The shortest pronounceable thing that carries the sound. English uses
  "mmmm" for continuous sounds and "buh" (lightest vowel) for stops —
  the way phonics teachers voice them. Find the equivalent convention in the
  target language's teaching (Arabic teachers voice a letter with fatha:
  "بَ" /ba/).
- `null` when the letter has no sound of its own to teach: Hebrew א and ע
  are silent carriers; for kana the name already is the sound. With `null`
  the game says the name instead.
- Listen to the generated clip. TTS voices are worst at isolated sounds;
  re-spell or record by hand if the clip says the name instead.

**`ipa`, `romanization`, `note`** — for reviewers and future sessions.
Notes are where you explain the traps (dagesh, sun/moon letters, "は is read
'wa' as a particle").

**`keys`** — only if the default (`[char, secondary]`) is wrong, e.g. a
letter typed with a dead key. Leave typing off for IME scripts.

### Second form

Pick when it appears (`introduceSecondaryFromBox`, 0–4) by how children
meet it: English lowercase at box 2 (early: it's everywhere in books);
Hebrew final forms at box 3 (they only appear at the end of a word);
katakana at box 4 or not at all (usually learned after hiragana).
Explain the choice in NOTES.md.

---

## Teaching order

<a id="curriculum"></a>
`curriculum` is the order letters enter the child's pool (the pool starts
with the first 6 and grows by one per mastered letter). Alphabetical order
is almost never best. Order by, in this priority:
1. **What local teachers do**, when there's an established sequence.
2. **Visual distinctness early**: keep look-alike pairs (ב/כ, ب/ت/ث, さ/ち)
   several letters apart so each is solid before its twin arrives.
3. **Frequency and usefulness**: letters that let the child read real,
   picturable words soon (and fill the blend round).
4. **Easy sounds first**: continuous, distinct sounds before subtle ones.
5. Silent letters, rare letters and letters that never start a word last.

`chapters` slice the curriculum into 4–6 story chapters with warm names in
the target language (they appear as the World-map zones / Nest groups).

---

## Words

<a id="words"></a>
Every letter needs **3+ words** (2 minimum), each with a picture. Every
word must be:
- **Known to a 4–6 year old** in that language — everyday objects, animals,
  food, family, toys. Not what a dictionary lists first.
- **Picturable, unambiguously**: one clear object a child names the same way
  from the picture alone. Avoid abstract words, actions, and things that look
  like something else (a lime drawn looks like a lemon).
- **Starting with the letter's taught sound**, clearly: no silent first
  letter, no blend that hides the sound, no loanword whose first sound
  differs from the letter's usual sound.
- **Written as a young reader sees it**: with vowel marks where beginner
  books use them (Hebrew niqqud, Arabic harakat); hiragana only for
  Japanese (no kanji).
- **Culturally fine and unambiguous in meaning**: check it isn't slang for
  something else, a brand, or regional.
- **Reusing existing art where the meaning is the same**: set `art` to an
  existing picture id (`ls app/public/art/flashcards/*.jpg`) — "cat" is
  still `cat` in Hebrew (חָתוּל, under ח). New concepts get new pictures
  (see [pictures](#pictures)).

<a id="initial-sounds"></a>
**`initialSound`** is the key the odd-one-out storm compares. Rules:
- Two words have the same key **iff** a child hears the same first sound.
  Hebrew כּוֹבַע (k) and קוֹף (k) share `k`; תַּפּוּחַ and טֶלֶפוֹן share `t`.
  Japanese keys are the first mora (`ne`, `ka`).
- Usually the letter's romanization — but file each word under the letter
  it's WRITTEN with and key it by what's HEARD.
- For every letter, try to have **two pictured words with the same key**:
  that's what lets the letter host a storm.
- `confusableSounds`: pairs too close to contrast for a young child
  (voiced/voiceless twins b/p, emphatic/plain Arabic s/ṣ, neighbouring
  vowels). The storm never puts them against each other.

---

## Look-alikes

<a id="look-alikes"></a>
`lookAlikes` are pairs children confuse **by shape** (English b/d, p/q):
the matchup round shows both and asks which one it said. Take them from the
script guide and from teachers' lists of common reversal errors. Set
`lookAlikeForm` to the form where the confusion lives (English: lowercase;
Hebrew/Arabic/kana: primary).

---

## Rounds

<a id="rounds"></a>
Every round must serve reading ([`02-pedagogy.md`](../02-pedagogy.md)).
Turn a round off (`null` / `false`) rather than fill it with content that
doesn't teach anything in this language.

**Blend** (`rounds.blend`): catch the letters of a short word in reading
order, then hear it blended. English uses CVC words (c-a-t). Find the
language's equivalent first decodable words: Hebrew 2–3 letter pointed
words (אַבָּא), Arabic 3-letter words with short vowels, Japanese 2–3 kana
words (ね-こ), Korean jamo into one block (ㄱ+ㅏ → 가). Letters are listed
in reading order; the UI mirrors them for RTL. 10–20 words, all known and
ideally pictured.

**Missing piece** (`rounds.missingPiece`): a word with one gap and three
droppable choices. English: the short vowel (C _ T). Equivalents: Hebrew
niqqud on one letter, Arabic harakat, Japanese dakuten (か vs が) or a
missing kana, Korean vowel jamo. Each word lists its display `parts`, the
`gap` index and the `answer` choice id. Choices need a `speak` text (the
sound of that piece).

**Odd-one-out sound storm** (`rounds.oddSound`): automatic from
`initialSound` — just make sure enough letters can host one.

**Rainbow** (`rounds.rainbow`): the six colour words; set `letter` when a
colour word starts with a pack letter (then that colour glows when its
letter is next). A colour word starting with a letter outside the pack
gets `letter: null`.

**Plane choice** (`rounds.planeChoice`): automatic from the letters.

---

## Phrases

<a id="phrases"></a>
Translate every key of the English pack's `phrases` — spoken to the child,
so write them the way a warm kindergarten teacher talks, not as a literal
translation. Keep every `{placeholder}`; move it where the grammar needs
it. Counted phrases give one text per plural category the language uses
(`new Intl.PluralRules('<code>').resolvedOptions().pluralCategories`:
Hebrew one/two/other, Arabic zero/one/two/few/many/other, Japanese other).
Write pointed Hebrew / vowelled Arabic so TTS reads it right.

---

## Pictures

<a id="pictures"></a>
Pictures are shared across languages (`app/public/art/flashcards/<art>.jpg`
AI art at 1024×1024, or a hand-drawn `<art>.svg` icon). For a word with no
picture yet:
1. `node app/scripts/lang/build-flashcards.mjs <code> --art-manifest` writes
   `app/scripts/lang/out/<code>-art-manifest.json`.
2. Review each prompt (describe the object concretely: colour, one object,
   centred), then merge the entries into `assets/manifest.json`'s `assets`
   (drop the `_for` field).
3. `cd assets && node generate.mjs --dry-run --only=word-<id>`, then without
   `--dry-run` (needs `GEMINI_API_KEY`; see `assets/README.md`). Output lands
   in `assets/generated/`.
4. Look at it. Then save it as `app/public/art/flashcards/<id>.jpg`,
   1024×1024 JPEG (e.g. `python3 -c "from PIL import Image; Image.open('assets/generated/word-<id>.png').convert('RGB').resize((1024,1024)).save('app/public/art/flashcards/<id>.jpg', quality=88)"`).
5. Set the word's `art` to `<id>` and rebuild.

Art must never contain text or letters (they'd be in the wrong language).

---

## Strokes

<a id="strokes"></a>
`app/languages/<code>/strokes.mjs` gives every form (primary and secondary)
its strokes: one SVG path per pen stroke, in teaching order, drawn in the
writing direction. It drives the "watch it written" animation, the tracing
guide on the cloud and the writing page.

- **Author them yourself** with the stroke kit (`app/scripts/lang/stroke-kit.mjs`:
  `line`, `arc` by clock angles, `ring`, `pen().line().quad().cubic().arc()`,
  `dot`), computed from named coordinates so they can be retuned.
- **Licensing:** never copy stroke data from KanjiVG, Unicode or font-derived
  datasets, other apps, or font outlines. Most are CC BY-SA, whose
  share-alike terms conflict with this project's proprietary license. Use
  such sources only to *read* the correct order, and write your own geometry.
- **Correctness:** stroke order and direction must match what the child's
  teachers teach. Cite the source in NOTES.md and have the reviewer confirm.
  Guessing is not acceptable — a wrong stroke order is taught, then untaught.
- **Check every letter** in the preview: `node app/scripts/lang/build-strokes.mjs <code> --preview`
  → `app/scripts/lang/out/<code>-strokes.html`. The grey glyph is the cloud
  font fitted exactly as the game fits the tracing guide; strokes should run
  along its centreline, numbers mark stroke starts, arrows direction.
- Respect the guide lines (they're drawn on the writing page).
- Dots that are part of the letter (Arabic i'jam: ب has one below, ت two
  above) are strokes: use `dot(x, y)`. Vowel and pronunciation marks (Hebrew
  niqqud and dagesh, Arabic harakat) are not part of the letter's strokes.

---

## Fonts

<a id="fonts"></a>
`script.fonts.display` draws the clouds, planes, cards and letter badges —
the letter's teaching shape. Choose a Google Fonts family that:
- covers every character (the validator checks the real font file);
- has **print shapes a child is taught** (not calligraphic or stylised);
- reads well heavy and rounded (clouds are sampled from the glyph).

`script.fonts.ui` is for body text. Record the choice and alternatives in
NOTES.md. The profiles suggest a starting point for each script.

---

## Audio

<a id="audio"></a>
`node assets/generate-language-audio.mjs --lang=<code> --dry-run` lists
every clip with its exact TTS text. Fix any text that's ambiguous (add
vowel marks) before generating. Then generate (paid key recommended — a
language is 150–300 clips). Every clip gets listened to by the reviewer via
the review sheet; bad clips are deleted and regenerated, re-spelled, or
recorded by a person (same path, WAV).

---

## Review

<a id="review"></a>
1. `node app/scripts/lang/build.mjs <code>` (clean validation) and generate audio.
2. Send the reviewer `app/scripts/lang/out/<code>-review.html` and
   `<code>-strokes.html` (they're self-contained apart from web fonts and
   the pictures/audio next to them — zip the `app/public` files it links,
   or walk through it together).
3. They check every row; you fix; repeat.
4. Log the review in NOTES.md's table (date, reviewer, scope, result), then
   set `"status": "reviewed"`.

---

## A new script

<a id="new-script"></a>
If no profile fits (Greek, Georgian, Armenian, Devanagari, Thai…):
1. Copy the closest profile in `app/scripts/lang/profiles/` to a new file.
2. Fill the letter inventory (id, char, secondary per the forms model, name,
   aliases, ipa, romanization, notes), fonts, locales, writing guide,
   look-alikes and rainbow — facts only; leave judgement calls as `"TODO"`.
3. If the script needs a new forms model or writing guide, that's a code
   change: add it to `app/src/lang/types.ts`, `validate.mjs`, `stroke-kit.mjs`
   `GUIDE_METRICS`, and the Phase 0 runtime; document it in
   `docs/11-languages.md` and a new script guide here.
