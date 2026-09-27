# Other scripts

Short guides for scripts that have a profile (Russian, Korean, generic
Latin) and notes on harder cases. Read [the authoring guide](README.md)
first; **verify** = needs a native reviewer.

---

## Russian (`ru`) — Cyrillic

Profile: `russian`. Closest to English: **33 letters with upper and lower
case** (forms model `case`), left to right, `four-line` writing guide,
Nunito covers Cyrillic (checked), so the English fonts carry over.

- **Names** (prefilled): а, бэ, вэ, гэ … **verify** each clip — TTS may read
  a lone "е" as "ye" or "e".
- **Sounds** (`TODO`): Russian phonics teaches **sounds (звуки)** separately
  from letters — continuous sounds stretched ("ммм", "ссс"), stops with a
  minimal vowel. Hard/soft consonant pairs exist; teach the hard sound.
- **No sound of their own**: ъ and ь (hard/soft signs) → `sound: null`, no
  words (no word starts with them); **ы** starts no everyday word. Place all
  three last and explain the "no words" error in NOTES.md.
- **Iotated vowels** е ё ю я sound /je jo ju ja/ at a word's start; key
  their words' `initialSound` accordingly (`ye`, `yo` …).
- **Stress** changes vowel sounds (unstressed о sounds like а). Choose words
  whose first vowel is stressed, or key by what's heard.
- **Look-alikes** (prefilled, lowercase): б–в, ш–щ, ц–щ, и–й, е–ё, ь–ъ, э–е;
  also Latin look-alikes a child who knows English may mix (р/p, в/B, н/H) —
  worth noting for bilingual children.
- **Blend**: CVC words work exactly as in English (кот, дом, сок, мак, лук, сыр).
- **Missing piece**: the vowel, as in English (к_т → о).
- **Strokes**: Russian schools teach **cursive (прописи)** from first grade;
  print letters match the clouds. Same situation as Hebrew — print for v1.
- **Rainbow** (prefilled): красный, оранжевый, жёлтый, зелёный, синий
  (голубой is light blue — synonyms matter), фиолетовый.
- **Plurals**: one, few, many, other (1 буква, 2 буквы, 5 букв).

---

## Korean (`ko`) — Hangul

Profile: `korean`. Hangul is an alphabet of **jamo** packed into **syllable
blocks**: 한 = ㅎ + ㅏ + ㄴ. The pack's letters are the **24 basic jamo**
(14 consonants, 10 vowels), forms model `none`, `grid` writing guide.

- **Names**: consonants have names (기역, 니은 …); vowels are named by
  their sound with the silent ㅇ (아, 야 …). Prefilled.
- **Sounds** (`TODO`): a consonant's sound can't be said alone; teachers
  voice it with ㅏ (가, 나, 다 …). Vowels: the vowel itself.
- **ㅇ** is silent at the start of a syllable (it only holds the place), and
  /ŋ/ at the end. Words starting with ㅇ start with a vowel sound: key their
  `initialSound` by the vowel.
- **Words** are filed under their first jamo (the validator unpacks blocks).
- **Blend** is the natural Korean round: catch the jamo, see them **assemble
  into a block** (ㄱ + ㅏ → 가), then into a word (가 + 방 → 가방). List the
  jamo of each word in writing order; the UI shows the composed `text`.
- **Missing piece**: the vowel jamo of one block (ㄱ_ → ㅏ), a real early
  reading skill.
- **Look-alikes** (prefilled): ㄱ–ㅋ, ㄷ–ㅌ, ㅂ–ㅍ, ㅈ–ㅊ (aspiration
  strokes), ㅏ–ㅓ, ㅗ–ㅜ, ㅑ–ㅕ, ㅛ–ㅠ (mirror images).
- **Fonts**: Jua (clouds; rounded, covers jamo — checked), Gowun Dodum (UI).
- **Rainbow**: 빨강 starts with ㅃ, a double consonant outside the 24 →
  `letter: null` (prefilled).
- **Plurals**: other only; counters as in Japanese.

---

## Latin-alphabet languages (Spanish, French, German, Italian, Portuguese, Turkish, Polish …)

Profile: `latin` (a–z with names and sounds `TODO`). The English machinery
fits best here; the work is in the details:

- **Add the language's own letters** as letters, in the order children
  learn them: Spanish **ñ**; German **ä ö ü ß** (ß has no traditional
  uppercase — `secondary` handling: make ß's `char` "ẞ" only if the local
  school uses it, otherwise treat it as lowercase-only and explain); Polish
  ą ć ę ł ń ó ś ź ż; Turkish ç ğ ı ö ş ü.
- **Remove letters the language doesn't use natively** (Italian has no j k w
  x y in native words), or keep them late with loanwords.
- **Accented vowels** (é è ê in French, á in Spanish) are usually the *same
  letter* to a child: don't add them as letters; words may contain them.
- **Turkish casing trap**: i/İ and ı/I are different letters. The pack's
  explicit `secondary` handles this; Phase 0 must never derive forms with
  `toLowerCase()`/`toUpperCase()` (which is locale-dependent).
- **Digraphs** (Spanish ch/ll/rr, Dutch ij, Welsh ll): not letters in the
  pack (one grapheme per letter); teach them in the blend round.
- **Letter names** differ from English and matter to teachers (German "Ha",
  French "ache" for H): spell them for TTS.
- **Sounds**: most European phonics teach letter sounds like English;
  vowels are usually pure (no English-style short/long pair), which changes
  the missing-piece round from "short vowel" to "which vowel".
- **Look-alikes** carry over (b/d/p/q, m/w, n/u).
- **Fonts**: Nunito covers Latin Extended, including ñ ß ç ı İ (checked).
- **Handwriting check**: the EMNIST model only knows a–z; keep it off even
  for Latin packs unless the pack's letters are exactly a–z.

---

## Harder cases

**Greek** — case model works; **final sigma ς** is a third form of σ (the
schema has only two forms). Treat ς like a Hebrew final: accept it in words
and the blend round, and note the limitation (or extend the forms model).

**Devanagari (Hindi, Marathi…), Bengali, Tamil, Thai, Khmer** — abugidas:
consonants carry an inherent vowel, other vowels are marks (matras) around
them, and conjuncts merge letters. Letters = consonants + independent
vowels; the **missing-piece round is the matra** (क → का कि की), the blend
round builds syllables. Thai letter names are acrophonic ("ก ไก่", "k as in
chicken") — each name already contains a word, a natural fit for flash
cards; Thai also has tones. These need a new profile, possibly a new forms
model, and careful design — scope them as their own project. Baloo has
per-script siblings (Baloo 2 for Devanagari, Baloo Da 2 for Bengali, Baloo
Thambi 2 for Tamil) that match the game's look.

**Chinese** — out of scope for letter learning (thousands of characters).
A Chinese pack could teach **Zhuyin (Bopomofo)** in Taiwan (37 symbols —
an alphabet-sized set that fits this game well) or **Pinyin** (Latin
profile) in mainland China.

**Mixed-script bilingual children** — a child learning Hebrew and English
has two packs and two progress sets (Phase 0 keeps progress per language);
the grown-up switches the learning language in the Dashboard.
