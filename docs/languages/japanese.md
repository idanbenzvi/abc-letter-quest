# Japanese (`ja`) — script guide

Profile: `japanese-hiragana` (`node app/scripts/lang/new-language.mjs ja --profile=japanese-hiragana`).
Read [the authoring guide](README.md) first. **verify** = needs a native
reviewer, ideally someone who teaches 年長 / 小学1年 children.

## The script at a glance

- Japanese children learn **hiragana** first (46 basic kana), then
  **katakana**, then kanji. This pack teaches **hiragana**; katakana is its
  optional second form (forms model `kana`, from mastery box 4 — or set the
  model to `none` and make katakana its own pack, `ja-kata`, if the family
  prefers them separate). Kanji are out of scope.
- A kana is a **syllable (mora)**, not a consonant: か is /ka/. So a kana's
  **name is its sound** → every `sound` is `null` (the game says the name),
  and the grown-ups "Letter voice: names/sounds/both" setting is meaningless
  for this pack (hide it when every sound is null — Phase 0 step 10).
- **Written left to right** in the game (horizontal writing, 横書き).
- **Dakuten/handakuten** make 25 more kana (が ざ だ ば ぱ rows). Add them as
  **extra letters after the basic 46** once the basics are in place (ids
  `ga`, `gi` …), or leave them for later. Small kana (ゃ ゅ ょ っ) and
  combinations (きゃ) are out of scope for v1.
- Two kana never start a word: **を** (only the object particle; sounds like
  お) and **ん**. Give them **no words** and explain the validator error in
  NOTES.md (or place them last and accept the error until Phase 0 adds an
  explicit "no words" flag).

## Decisions (defaults — confirm in NOTES.md)

| Decision | Default | Why |
|---|---|---|
| Teaching order | gojūon (あいうえお…) | The あいうえお表 order is how Japanese children meet kana. **verify** against the child's program; some teach by stroke simplicity (く し つ へ の first). |
| Writing guide | `grid` | Kana are practised in square cells with a dashed centre cross (マス目・十字リーダー). |
| Display font | M PLUS Rounded 1c 800 (clouds) | Rounded, heavy, full kana coverage (checked). |
| Tracing reference | consider **Klee One** 600 | A 教科書体-style font: its kana have the separate strokes children are taught (き has 4, さ has 3), unlike gothic fonts which join them. Try it as the display font if the stroke preview shows mismatches. Coverage checked. |
| Typing | **off** | Kana are typed through an IME; `KeyboardEvent.key` is "Process". A romaji buffer (k + a → か) is possible later. |
| Speech | `ja-JP` | Recognisers return kanji/katakana for a lone syllable — see aliases. |

## Aliases

`nameAliases` is prefilled with the hiragana and katakana. A recogniser
hearing a child say "ka" may return 蚊, 課, 可, カ, か or "ka"; saying "ki"
may give 木 or 気. Add the common one-syllable kanji words per kana
(**verify** with a quick test in Chrome's recogniser: `listenOnce('ja-JP')`).

## Stroke order

Stroke order (書き順) is standardised and strictly taught; get it exactly
right, citing a school textbook or a 文部科学省-aligned guide. Textbook
(教科書体) stroke counts for reference (**verify** each):

あ3 い2 う2 え2 お3 · か3 き4 く1 け3 こ2 · さ3 し1 す2 せ3 そ1 ·
た4 ち2 つ1 て1 と2 · な4 に3 ぬ2 ね2 の1 · は3 ひ1 ふ4 へ1 ほ4 ·
ま3 み2 む3 め2 も3 · や3 ゆ2 よ2 · ら2 り2 る1 れ2 ろ1 · わ2 を3 ん1

- Never copy stroke data from **KanjiVG** (CC BY-SA 3.0 — share-alike
  conflicts with this project's license) or similar datasets; author with the
  stroke kit's `pen().cubic()` curves in the `grid` box (inner square
  10–90, centre 50,50).
- Endings (とめ stop, はね hook, はらい sweep) matter to teachers but the
  tracer doesn't score them; draw the path so its final segment points the
  right way.
- Compare each kana with the display font in the stroke preview; if the
  gothic font joins strokes the child writes separately, switch the display
  font to Klee One or accept the fit.

## Words

Hiragana only (no kanji, no katakana loanwords except when unavoidable —
and then file them under the hiragana letter whose katakana they start
with). `initialSound` is the **first mora's romaji** (`ne`, `ka`). Avoid
words starting with a small-kana combination (ちょうちょ starts with "cho",
not "chi").

Starter candidates (**verify**); `art` = existing shared picture:

| Kana | Word | Gloss | art |
|---|---|---|---|
| あ | あり | ant | ant |
| あ | あめ | rain / candy (ambiguous — pick a picture) | — |
| い | いぬ | dog | dog |
| い | いちご | strawberry | — |
| う | うさぎ | rabbit | rabbit |
| う | うま | horse | horse |
| え | えんぴつ | pencil | — |
| お | おにぎり | rice ball | — |
| か | かさ | umbrella | umbrella |
| か | かえる | frog | frog |
| き | きりん | giraffe | — |
| き | きのこ | mushroom | mushroom |
| く | くま | bear | bear |
| く | くるま | car | car |
| け | けむし | caterpillar | — |
| こ | こま | spinning top | — |
| さ | さかな | fish | fish |
| さ | さる | monkey | — |
| し | しか | deer | — |
| す | すいか | watermelon | watermelon |
| せ | せみ | cicada | — |
| そ | そり | sled | — |
| た | たまご | egg | egg |
| た | たこ | octopus | octopus |
| ち | ちず | map | — |
| つ | つき | moon | moon |
| て | て | hand | — |
| と | とら | tiger | tiger |
| と | とり | bird | — |
| な | なす | eggplant | — |
| に | にんじん | carrot | — |
| ぬ | ぬいぐるみ | stuffed toy | — |
| ね | ねこ | cat | cat |
| の | のり | seaweed | — |
| は | はな | flower | — |
| ひ | ひこうき | airplane | — |
| ふ | ふね | boat | — |
| へ | へび | snake | — |
| ほ | ほし | star | star |
| ま | まど | window | — |
| み | みかん | mandarin | orange (reads as a mandarin? **verify**) |
| む | むし | bug | insect |
| め | めがね | glasses | — |
| も | もも | peach | — |
| や | やま | mountain | — |
| ゆ | ゆきだるま | snowman | — |
| よ | ヨーヨー | yo-yo (katakana loanword, filed under よ) | yoyo |
| よ | ようふく | clothes | — |
| ら | らいおん | lion | lion |
| り | りんご | apple | apple |
| る | (few picturable words — note it) | | |
| れ | れもん | lemon | — |
| ろ | ろうそく | candle | — |
| わ | わに | crocodile | alligator |

## Rounds

**Blend** — 2–3 kana words, caught in order then read whole: ねこ, いぬ,
くま, かさ, さる, たこ, はな, ほし, うま, とり, ふね, りんご, すいか.

**Missing piece** — a missing **kana** in a pictured word (ね_ → こ), choices
drawn from kana; once dakuten letters exist, a **dakuten contrast** (か/が:
かき vs かぎ) is an excellent Japanese-specific version. Choices' `speak`
is the kana itself.

**Odd-one-out storm** — keys are first morae; `confusableSounds`
candidates: ka/ga, sa/za, ta/da, ha/ba/pa, and o/wo (identical).

**Rainbow** (prefilled): あか (あ), オレンジ (お, via its katakana form),
きいろ (き), みどり (み), あお (あ), むらさき (む).

## Phrases

`Intl.PluralRules('ja')` has only **other**. Counts use counters
(もじ for letters, こ for eggs, わ for birds): "{count}もじ かえったよ！".
Write phrases in hiragana only, friendly です/ます-free kindergarten
register (e.g. 〜だよ、〜してね), and confirm the register with the reviewer.
