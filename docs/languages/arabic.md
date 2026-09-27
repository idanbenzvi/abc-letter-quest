# Arabic (`ar`) — script guide

Profile: `arabic` (`node app/scripts/lang/new-language.mjs ar --profile=arabic`).
Read [the authoring guide](README.md) first. Everything marked **verify**
needs a native-speaking reviewer — ideally a teacher from the target region.

## The script at a glance

- **28 letters**, written **right to left**, and **joined**: most letters
  connect to the next and change shape by position — isolated, initial,
  medial, final. Browsers shape this automatically from the plain letters.
- **Six letters never join to the next letter**: ا د ذ ر ز و. They have
  only isolated and final shapes.
- **Dots (i'jam)** are what tell many letters apart: ب ت ث ن ي share one
  body; ج ح خ; د ذ; ر ز; س ش; ص ض; ط ظ; ع غ; ف ق. These families are the
  look-alikes.
- An **abjad**: short vowels are marks (**harakat**: fatha ـَ, kasra ـِ,
  damma ـُ, sukun ـْ, shadda ـّ, tanween). Children's books are vowelled —
  write every word, name and phrase **with harakat**.
- **Extra characters that aren't in the 28** but appear in words: hamza ء
  and its seats أ إ ؤ ئ, ta marbuta ة (word-final), alif maqsura ى, and the
  lam-alif ligature لا (automatic). Words containing them are fine; the
  validator's blend check may warn — explain in NOTES.md.

## Decisions (defaults — confirm in NOTES.md)

| Decision | Default | Why |
|---|---|---|
| Forms model | `positional`: `secondary` = initial form, written `char + U+200D` (null for the 6 non-joiners) | The initial form is the most common in reading after the isolated one; the ZWJ makes it render joined on a cloud. |
| Second form from | mastery box 3 | Isolated shape first. |
| Look-alike form | `primary` (isolated) | Dot families. |
| Writing guide | `baseline` | Everything hangs off one strong baseline; ا ل ك ط rise to `asc`, tails (ر ز و ن ي ع ج ح خ م) drop toward `desc`. |
| Fonts | Baloo Bhaijaan 2 (800 clouds, 500 UI) | Rounded, child-friendly, the Arabic member of the Baloo family the English UI already uses; covers letters and harakat (checked). Alternatives: Tajawal, Cairo, Noto Kufi Arabic. |
| Variety & locale | Modern Standard Arabic words, `ar-SA` recognition (**choose** with the family: `ar-EG`, `ar-JO`, `ar-AE`, …) | Children speak a dialect but learn to read MSA. Pick words a child in the target region actually says, and a TTS voice/locale that matches. |
| Typing | on | Arabic keyboard layouts produce the letters. |

## Letter names and sounds

Names are prefilled (ألف، باء، تاء …). **Sounds** are `TODO`. The standard
classroom convention is the letter **with fatha**: `"بَ"` (/ba/), `"تَ"`,
`"ثَ"` … which TTS reads well. For alif, use `"أَ"` (/ʔa/) or `null`
(**decide**: alif is a long-vowel letter and hamza carrier). **verify** each
clip — emphatic letters (ص ض ط ظ ق) must sound emphatic, and ع/ح/خ/غ must
be distinct.

`ج` is /dʒ/ in MSA but /g/ in Egyptian — match the chosen variety.

## Teaching order

Arabic is very often taught in **alphabetical order, one dot-family at a
time** (ب ت ث together), which deliberately contrasts the dots. That
conflicts with this game's default of spacing look-alikes apart — **follow
the local practice** (the look-alike round then reinforces the dots) and
note the choice. Alternatively teach frequent letters first (ب ت ر س م ن ل …).

## Look-alikes (prefilled)

ب–ت, ت–ث, ب–ن, ج–ح, ح–خ, د–ذ, ر–ز, س–ش, ص–ض, ط–ظ, ع–غ, ف–ق. Also
consider ن–ي (final/isolated), and ه–ة.

## Words

Rules specific to Arabic:
- **Never use the article ال**: every word would start with ا (and the ل is
  silent before "sun letters"). Use indefinite forms: قِطَّة, not القِطَّة.
- Words starting with hamza (أَرْنَب, أَسَد) are filed under **alif** with the
  vowel as `initialSound` (`a`, `i`, `u`).
- Prefer words that are the same in MSA and the target dialect.

Starter candidates (**verify** harakat and naturalness); `art` = existing
shared picture, `—` = needs one:

| Letter | Word | Gloss | initialSound | art |
|---|---|---|---|---|
| ا | أَرْنَب | rabbit | a | rabbit |
| ا | أَسَد | lion | a | lion |
| ب | بَطَّة | duck | b | duck |
| ب | بَيْت | house | b | house |
| ب | بَقَرَة | cow | b | — |
| ت | تُفَّاحَة | apple | t | apple |
| ت | تِمْسَاح | crocodile | t | alligator |
| ث | ثَعْلَب | fox | th | — |
| ج | جَمَل | camel | j | — |
| ج | جَزَر | carrots | j | — |
| ح | حِصَان | horse | ḥ | horse |
| ح | حَلَزُون | snail | ḥ | snail |
| خ | خَرُوف | sheep | kh | — |
| خ | خُبْز | bread | kh | — |
| د | دُبّ | bear | d | bear |
| د | دَجَاجَة | hen | d | — |
| ذ | ذُرَة | corn | dh | — |
| ذ | ذِئْب | wolf | dh | — |
| ر | رُمَّان | pomegranate | r | — |
| ر | رِيشَة | feather | r | feather |
| ز | زَرَافَة | giraffe | z | — |
| ز | زَهْرَة | flower | z | — |
| س | سَمَكَة | fish | s | fish |
| س | سَيَّارَة | car | s | car |
| ش | شَمْس | sun | sh | sun |
| ش | شَجَرَة | tree | sh | — |
| ص | صَقْر | falcon | ṣ | — |
| ص | صَابُون | soap | ṣ | — |
| ض | ضِفْدَع | frog | ḍ | frog |
| ط | طَائِرَة | airplane | ṭ | — |
| ط | طَاوُوس | peacock | ṭ | — |
| ظ | ظَرْف | envelope | ẓ | — |
| ع | عِنَب | grapes | ʿ | grapes |
| ع | عَيْن | eye | ʿ | — |
| غ | غَزَال | gazelle | gh | — |
| غ | غُرَاب | crow | gh | — |
| ف | فِيل | elephant | f | elephant |
| ف | فَرَاشَة | butterfly | f | — |
| ق | قِطَّة | cat | q | cat |
| ق | قَمَر | moon | q | moon |
| ك | كَلْب | dog | k | dog |
| ك | كُرَة | ball | k | ball |
| ل | لَيْمُون | lemon | l | — |
| م | مَوْز | bananas | m | banana |
| م | مِفْتَاح | key | m | key |
| ن | نَحْلَة | bee | n | — |
| ن | نَمِر | tiger | n | tiger |
| ه | هِلَال | crescent moon | h | — |
| و | وَرْدَة | rose | w | — |
| و | وَلَد | boy | w | — |
| ي | يَد | hand | y | — |

`confusableSounds` to consider: s/ṣ, d/ḍ, t/ṭ, dh/ẓ, h/ḥ, k/q, ʿ/a (hamza
onset), th/s, dh/z.

## Rounds

**Blend** — three-letter words with short vowels, letters listed in
reading order; the word appears joined at the end: قَمَر (ق-م-ر), بَيْت
(ب-ي-ت), كَلْب (ك-ل-ب), دُبّ (د-ب), شَمْس (ش-م-س), وَلَد (و-ل-د),
نَمِر (ن-م-ر), عِنَب (ع-ن-ب). While letters are being caught, each shows in
isolated form; the finished word is `text` (joined).

**Missing piece** — the **short vowel (haraka)** of a letter, the exact
skill beginning readers practise: choices `{ id: "fatha", text: "بَ",
speak: "بَ" }`-style syllables (or fatha/kasra/damma on the gapped letter),
e.g. word قَمَر with `parts ["قَ","مَ","ر"]`, `gap: 0`. As in Hebrew, prefer
same-letter distractors (بَ / بِ / بُ).

**Rainbow** (prefilled): أحمر (ا), برتقالي (ب), أصفر (ا), أخضر (ا), أزرق
(ا), بنفسجي (ب) — add harakat. Four start with alif: the glow match will
usually pick red for alif; that's fine.

## Strokes

- Order: the letter's **body first, right to left, then dots, then any
  other mark** (hamza, the stroke of ك, the vertical of ط). Alif is one
  stroke top to bottom. **verify** with a school handwriting (خط النسخ for
  children) guide.
- Author isolated forms and the initial forms (`char + ZWJ` keys) — the
  initial form is the isolated body without its final tail.
- Dots are `dot(x, y)` strokes; two/three dots are separate taps.
- `baseline` metrics: `base` 78 is the writing line; `tooth` 52 the top of
  short bodies; `asc` 10; `desc` 112.

## Phrases

`Intl.PluralRules('ar')` uses **zero, one, two, few, many, other** — every
counted phrase needs all six (e.g. 0 بيضة, بيضة واحدة, بيضتان, 3–10
بيضات, 11–99 بيضة, 100+). Address the child in the gender the family
prefers, consistently, and write phrases vowelled.

## Digits

The UI may show Eastern Arabic digits (٠١٢٣) via `Intl.NumberFormat('ar-…')`;
decide per region.
