# Hebrew (`he`) — script guide

Profile: `hebrew` (`node app/scripts/lang/new-language.mjs he --profile=hebrew`).
Read [the authoring guide](README.md) first; this page covers what's
specific to Hebrew. Everything marked **verify** must be confirmed by a
native-speaking reviewer (ideally a kindergarten or first-grade teacher).

## The script at a glance

- **22 letters**, written **right to left** (`direction: "rtl"`).
- An **abjad**: letters are mostly consonants. Vowels are shown by
  **niqqud** (points under/over letters) or implied. Beginning readers and
  children's books use **full niqqud** (כְּתִיב מְנֻקָּד) — so every word, name
  and phrase in the pack is written **with niqqud**.
- **Five final forms** (ך ם ן ף ץ) used at the end of a word → forms model
  `final`; `secondary` is the final form on כ מ נ פ צ, `null` elsewhere.
- **No case.**
- **Dagesh** changes three letters' sounds: בּ /b/ vs ב /v/, כּ /k/ vs כ /χ/,
  פּ /p/ vs פ /f/; the dot on ש distinguishes שׁ /ʃ/ from שׂ /s/. The pack
  keeps **22 letters** and teaches each by its word-initial sound (a
  word-initial ב/כ/פ nearly always has dagesh, so /b/, /k/, /p/). The other
  sounds appear in words and can be taught later — note it, don't add letters.
- **Silent letters**: א and ע carry a vowel and have no sound of their own
  (`sound: null`); ה is silent at the end of a word.
- **Same sound, different letters** (the odd-one-out storm must not treat
  these as different): ט = ת (/t/), כּ = ק (/k/), כ = ח (/χ/), ס = שׂ (/s/),
  ב = ו (/v/), א = ע (vowel onset). File each word under its written letter
  and key its `initialSound` by what's heard.

## Decisions (defaults — confirm in NOTES.md)

| Decision | Default | Why |
|---|---|---|
| Second form | final forms from mastery box 3 | Finals only appear word-finally; introduce once the regular form is solid. |
| Look-alike form | `primary` | The confusions are in the regular forms. |
| Writing guide | `two-line` | Print letters sit between a top line and a baseline; ל rises above, ק ך ן ף ץ drop below. |
| Display font | Fredoka 700 | Rounded, heavy (full clouds), covers Hebrew with niqqud (checked). Alternative: Varela Round 400 (lighter). |
| UI font | Rubik 400 | Clear Hebrew/Latin UI font. |
| Speech | `he-IL` recognition, `he` synthesis | |
| Typing | on | The Hebrew keyboard layout produces every letter and final form. |
| Handwriting check | off | EMNIST is Latin-only. |

## Letter names and sounds

Names are prefilled in the profile with niqqud (בֵּית, גִּימֶל …) plus the
unpointed spellings as speech aliases. **verify** each generated clip:
זַיִן in particular must be said as the letter name.

**Letter sounds** (`sound`) are left `TODO`. Israeli early reading is taught
through **letter + vowel combinations (צֵרוּפִים)** — בָּ, בִּ, בּוּ — rather than
bare consonants, and TTS voices can't say a lone consonant. Recommended:
spell each sound as the letter with **kamatz** — `"בָּ"` (/ba/), `"גָּ"`,
`"דָּ"` … — and `null` for א and ע. **verify** with the reviewer; some teachers
prefer the letter's sound with a shva-like minimal vowel.

## Teaching order

There is no single national order; kindergartens and first-grade programs
differ. Principles: separate the look-alikes (ב/כ, ד/ר, ה/ח/ת, ו/ז/ן, ג/נ,
ס/ם, ע/צ); start with frequent letters that quickly make real words; keep
finals for later (handled by the forms box, not the curriculum).

A starting draft that keeps every look-alike pair at least 4 letters apart
(**verify** against the child's actual program and adjust):

`מ ב ל ש א ת ד י נ ס ר ע ז פ ה ג ק צ ו ט ח כ` (מ first), i.e. as ids:
`mem bet lamed shin alef tav dalet yod nun samekh resh ayin zayin pe he gimel qof tsadi vav tet het kaf`

## Look-alikes (prefilled)

ב–כ, ד–ר, ה–ח, ח–ת, ו–ז, ג–נ, ס–ם (the profile uses מ; the confusion is with
its final form ם — consider pairing ס with the final form once finals
appear), ע–צ. Also common: ך–ן (final kaf vs final nun), י–ו, ט–מ. **verify**.

## Starter words

Very common, picturable words, pointed. Every one is a **candidate to
verify** (niqqud, naturalness for a 4–6 year old). `art` shows an existing
shared picture; `—` means a picture must be generated.

| Letter | Word | Gloss | initialSound | art |
|---|---|---|---|---|
| א | אַרְיֵה | lion | a | lion |
| א | אֲוִירוֹן | airplane | a | — |
| א | אֹזֶן | ear | o | — |
| ב | בַּיִת | house | b | house |
| ב | בָּנָנָה | banana | b | banana |
| ב | בַּלּוֹן | balloon | b | — |
| ג | גִּיטָרָה | guitar | g | guitar |
| ג | גָּמָל | camel | g | — |
| ג | גְּלִידָה | ice cream | g | — |
| ד | דָּג | fish | d | fish |
| ד | דֹּב | bear | d | bear |
| ד | דְּבוֹרָה | bee | d | — |
| ה | הִיפּוֹפּוֹטָם | hippo | h | — |
| ה | הֶלִיקוֹפְּטֶר | helicopter | h | — |
| ו | וֶרֶד | rose | v | — |
| ו | וִילוֹן | curtain | v | — |
| ז | זֶבְּרָה | zebra | z | zebra |
| ז | זְבוּב | fly | z | — |
| ז | זָנָב | tail | z | — |
| ח | חָתוּל | cat | kh | cat |
| ח | חִלָּזוֹן | snail | kh | snail |
| ח | חֲמוֹר | donkey | kh | — |
| ט | טִיל | rocket | t | rocket |
| ט | טַוָּס | peacock | t | — |
| ט | טֶלֶפוֹן | telephone | t | — |
| י | יָרֵחַ | moon | y | moon |
| י | יָד | hand | y | — |
| י | יֶלֶד | boy | y | — |
| כ | כֶּלֶב | dog | k | dog |
| כ | כּוֹבַע | hat | k | hat |
| כ | כַּדּוּר | ball | k | ball |
| כ | כּוֹכָב | star | k | star |
| ל | לִוְיָתָן | whale | l | whale |
| ל | לִימוֹן | lemon | l | — |
| ל | לֶחֶם | bread | l | — |
| מ | מְכוֹנִית | car | m | car |
| מ | מַפְתֵּחַ | key | m | key |
| מ | מִטְרִיָּה | umbrella | m | umbrella |
| נ | נְמָלָה | ant | n | ant |
| נ | נָחָשׁ | snake | n | — |
| נ | נֵר | candle | n | — |
| ס | סוּס | horse | s | horse |
| ס | סֵפֶר | book | s | — |
| ס | סִירָה | boat | s | — |
| ע | עַכְבָּר | mouse | a | mouse |
| ע | עוּגָה | cake | u | cake |
| ע | עֵץ | tree | e | — |
| פ | פִּיל | elephant | p | elephant |
| פ | פֶּרַח | flower | p | — |
| פ | פַּרְפַּר | butterfly | p | — |
| צ | צָב | turtle | ts | turtle |
| צ | צְפַרְדֵּעַ | frog | ts | frog |
| צ | צִפּוֹר | bird | ts | — |
| ק | קֶשֶׁת | rainbow | k | rainbow |
| ק | קוֹף | monkey | k | — |
| ק | קִפּוֹד | hedgehog | k | — |
| ר | רַכֶּבֶת | train | r | train |
| ר | רִמּוֹן | pomegranate | r | — |
| ר | רוֹבּוֹט | robot | r | — |
| ש | שֶׁמֶשׁ | sun | sh | sun |
| ש | שׁוּעָל | fox | sh | — |
| ש | שָׁעוֹן | clock | sh | — |
| ת | תַּפּוּחַ | apple | t | apple |
| ת | תַּנִּין | crocodile | t | alligator |
| ת | תּוּת | strawberry | t | — |

Notes: `alligator`'s picture works for תַּנִּין only if the reviewer agrees it
reads as a crocodile to a child. כּוֹכָב/כּוֹבַע/כַּדּוּר/כֶּלֶב give כ four /k/
words — enough for storms. `confusableSounds` to consider: b/p, d/t, g/k,
z/s, s/sh, ts/s, and the vowel keys a/e, e/i, o/u.

## Rounds

**Blend** — short pointed words whose letters (including vowel letters ו/י
and final forms) are listed in reading order. Candidates (**verify**):
אַבָּא (א-ב-א), אִמָּא (א-מ-א), דָּג (ד-ג), סוּס (ס-ו-ס), תּוּת (ת-ו-ת),
צָב (צ-ב), יָד (י-ד), נֵר (נ-ר), דֹּב (ד-ב), גַּן (ג-ן), פִּיל (פ-י-ל),
קוֹף (ק-ו-ף), בַּיִת (ב-י-ת). A final form is listed by its letter id
(`nun`, `pe`); the UI shows the final shape when the letter ends the word.

**Missing piece** — recommended: the **first syllable (צֵרוּף)** of a
pictured word. Choices are pointed letter+vowel syllables (`{ "id": "da",
"text": "דָּ", "speak": "דָּ" }`), words list `parts` like `["דָּ", "ג"]`
with `gap: 0`. The engine should prefer distractors with the **same
letter, different vowel** (דָּ / דִּ / דּוּ) — that's the actual skill; add
that preference when generalising `engine/vowelRound.ts` (Phase 0 step 8).

**Rainbow** (prefilled): אָדֹם (א), כָּתֹם (כ), צָהֹב (צ), יָרֹק (י),
כָּחֹל (כ), סָגֹל (ס).

## Strokes

- Trace **print letters** (כְּתַב דְּפוּס) — they match the clouds and what
  kindergartens teach. Israeli first graders then learn to *write* in
  **cursive** (כְּתַב יָד); a cursive stroke set for the writing page is a
  possible later addition (a second `strokes` source), not part of v1.
- Stroke order and direction: take them from an Israeli kindergarten or
  Ministry of Education print-writing guide, cite it in NOTES.md, and have
  the reviewer confirm. Most letters start at the top (often top-left of
  the roof or top-right), and horizontal strokes run in the direction the
  teaching source shows — do **not** assume left-to-right.
- `two-line` metrics: the body fills `top` 40 → `base` 92; ל's flag rises
  to `asc` 12; ק and the finals ך ן ף ץ descend to `desc` 116.
- Check every letter in the stroke preview against Fredoka's glyph.

## Phrases

Plural categories for `he`: one, two, other (as in "בֵּיצָה אַחַת",
"שְׁתֵּי בֵּיצִים", "שָׁלוֹשׁ בֵּיצִים"). Write every phrase pointed, in warm kindergarten register,
and use the gender-neutral or the child's grammatical gender consistently
(decide in NOTES.md — addressing the child directly in Hebrew is gendered).
