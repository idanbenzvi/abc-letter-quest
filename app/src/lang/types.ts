// The language-pack contract: everything the game needs to teach one
// language's letters. See docs/11-languages.md for the design and
// .claude/skills/add-language/SKILL.md for the workflow.
//
// Authored source lives in app/languages/<code>/pack.json (validated by
// app/scripts/lang/validate.mjs); `node app/scripts/lang/build.mjs <code>`
// turns it into app/src/lang/<code>/pack.generated.ts, typed against this
// file so `npx tsc -b` checks the shape too.
//
// Every field below names the engine code that consumes it today (for
// English, hardcoded) — the Phase 0 refactor in docs/11-languages.md
// replaces each hardcoded source with the matching field.

/** How a script's "second form" of a letter works — the generalisation of upper/lower case. */
export type FormsModel =
  /** Latin, Cyrillic, Greek: upper and lower case. `secondary` is the lowercase letter. */
  | 'case'
  /** Hebrew: five letters have a word-final form (כ/ך). `secondary` is the final form, null for the other 17. */
  | 'final'
  /** Arabic: contextual shapes. `secondary` is the initial form, written as char + ZWJ (U+200D) so it renders joined. */
  | 'positional'
  /** Japanese: hiragana primary, katakana `secondary` (a separate syllabary, introduced late). */
  | 'kana'
  /** One form only (e.g. a hiragana-only pack, Hangul jamo). `secondary` is always null. */
  | 'none';

/**
 * The lined page the writing round draws (components/WritingPractice.tsx)
 * and the metrics the stroke data is authored against:
 * - 'four-line': Latin handwriting lines (cap, x-height/mid, baseline, descender).
 * - 'two-line': a band between a top line and a baseline, letters hang from/sit on them (Hebrew print).
 * - 'baseline': one strong baseline with generous room above and below (Arabic).
 * - 'grid': a square cell with dashed centre cross (Japanese マス目, Korean).
 */
export type WritingGuide = 'four-line' | 'two-line' | 'baseline' | 'grid';

export interface FontRef {
  /** CSS family name, exactly as Google Fonts spells it, e.g. "Varela Round". */
  family: string;
  /** Weight used for clouds/cards (heavier reads better as a cloud). Must exist in the family. */
  weight: number;
}

export interface LetterDef {
  /** Stable ASCII slug ("alef", "ka", "b"). Key for progress storage, audio file names and stroke data. Never change it once shipped. */
  id: string;
  /** The primary form shown on a cloud — one grapheme, NFC-normalised. Replaces CURRICULUM_ORDER's A–Z (data/curriculum.ts). */
  char: string;
  /** Second form per the pack's FormsModel, or null. Replaces toLowerCase() in flightMission.ts / planeChoice.ts / strokeFit.ts. */
  secondary: string | null;
  /** The letter's NAME, spelled for TTS in the target script ("בֵּית", "ば", "Bee"). Replaces LETTER_SPOKEN_NAME (engine/letterNameMatch.ts). */
  name: string;
  /** What a speech recogniser may return when a child says the name. Include bare letter, spellings, homophones (kanji for kana). Replaces LETTER_NAME_ALIASES. */
  nameAliases: string[];
  /**
   * The letter's SOUND, spelled for TTS (English "buh"), or null when the
   * letter has no sound of its own to teach (Hebrew א/ע are silent carriers;
   * kana: the name already is the sound). Replaces LETTER_SOUND_SPELLING
   * (data/letterSounds.ts). With null, sayLetter() falls back to the name.
   */
  sound: string | null;
  /** IPA for grown-ups and reviewers, e.g. "/b/", "/χ/", "silent". Display only. */
  ipa: string;
  /** Latin transliteration for reviewers and file names in notes. Display only. */
  romanization: string;
  /** KeyboardEvent.key values that count as typing this letter. Default [char, secondary]. Empty = cannot be typed. Replaces /^[a-zA-Z]$/ (FlightGameScreen.tsx). */
  keys?: string[];
  /** Free-text teaching note shown to reviewers (e.g. "dagesh: בּ /b/ vs ב /v/"). */
  note?: string;
}

export interface WordDef {
  /** Stable ASCII slug, unique within the pack. Audio file: public/audio/<code>/words/<id>.wav. */
  id: string;
  /** Letter id this word is filed under — the word must START with that letter's sound (see initialSound). */
  letter: string;
  /** Display text in the target script, as a 4–6 year old reader would see it (Hebrew/Arabic: with vowel marks). */
  text: string;
  /** TTS input when it differs from `text` (e.g. a disambiguating spelling). Default: text. */
  speak?: string;
  /**
   * The word's first SOUND as a key (usually the letter's romanization,
   * e.g. "b", "kh", "ka"). Words filed under different letters but sharing
   * a sound share a key — the odd-one-out storm (engine/oddSound.ts)
   * compares these, never letters. Replaces SOUND_OVERRIDES (data/initialSounds.ts).
   */
  initialSound: string;
  /** Picture concept id — reuses app/public/art/flashcards/<art>.(jpg|svg) when it exists. Omit if there is no picture yet. */
  art?: string;
  /** English gloss for reviewers who don't read the script. */
  gloss: string;
}

export interface BlendWord {
  id: string;
  /** Letter ids in READING order (right-to-left scripts too — the UI lays them out per `direction`). Replaces CVC_WORDS (data/cvcWords.ts). */
  letters: string[];
  /** The whole word as displayed once blended (joined Arabic, niqqud Hebrew). */
  text: string;
  gloss: string;
  art?: string;
}

export interface MissingPieceRound {
  /**
   * "Which piece is missing?" (English Storm Vowels, engine/vowelRound.ts):
   * a word with one gap and 2–3 choices. `choices` are the droppable pieces
   * (short vowels, niqqud, harakat, kana); each word names its parts in
   * reading order, the gap index and the right choice.
   */
  choices: { id: string; text: string; speak: string }[];
  words: { id: string; parts: string[]; gap: number; answer: string; text: string; gloss: string; art?: string }[];
}

export interface RainbowColorDef {
  id: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';
  /** Colour word in the target language. Replaces RAINBOW_COLORS[].word (engine/rainbowChoice.ts). */
  text: string;
  /** Letter id the colour word starts with — the rainbow glows the colour matching the upcoming letter when one exists. */
  letter: string | null;
}

export interface LanguagePack {
  schemaVersion: 1;
  /** BCP-47 primary tag: "en", "he", "ar", "ja". Folder name and storage namespace. */
  code: string;
  name: string;
  nativeName: string;
  /** 'draft' until a native speaker has reviewed every letter, word and recording (docs/languages/README.md#review). */
  status: 'draft' | 'reviewed';
  script: {
    id: string;
    direction: 'ltr' | 'rtl';
    forms: {
      model: FormsModel;
      /** Grown-ups labels for the two forms ("Uppercase"/"Lowercase", "Regular"/"Final form"). */
      primaryLabel: string;
      secondaryLabel: string | null;
      /** Mastery box (0–4) from which the secondary form starts appearing on clouds. English: 2 (see flightMission.ts lowercaseChance). */
      introduceSecondaryFromBox: number;
    };
    fonts: {
      /** Clouds, cards, planes, stroke fitting — the letter's teaching shape. */
      display: FontRef;
      /** Grown-ups screens and body text. */
      ui: FontRef;
    };
    writingGuide: WritingGuide;
  };
  locales: {
    /** SpeechRecognition.lang, e.g. "he-IL". Replaces the 'en-US' default in engine/speech.ts. */
    speechRecognition: string;
    /** Prefix a browser SpeechSynthesis voice's lang must start with. Replaces the 'en' filter in engine/audio.ts. */
    speechSynthesis: string;
  };
  /** Feature switches for mechanics that can't work in this language (yet). */
  features: {
    /** Webcam handwriting check (EMNIST, English letters only). */
    handwritingCheck: boolean;
    /** Typing a letter on a keyboard solves its cloud. False for IME scripts (Japanese). */
    typing: boolean;
    /** "Say the letter's name" via SpeechRecognition. */
    speakLetter: boolean;
    /** "Think of your own word" bonus (engine/wordMatch.ts). */
    ownWord: boolean;
  };
  letters: LetterDef[];
  /** Letter ids in teaching order. Replaces CURRICULUM_ORDER. */
  curriculum: string[];
  /** Story chapters (data/zones.ts): consecutive slices of the curriculum. Sizes must add up to curriculum.length. */
  chapters: { id: string; name: string; size: number }[];
  words: WordDef[];
  /** Sound-key pairs too close to contrast for a young child (b/p, voiced/voiceless twins). Replaces CONFUSABLE_SOUNDS. */
  confusableSounds: [string, string][];
  /** Letter-id pairs confused by SHAPE, for the look-alike matchup. Replaces CONFUSABLE_LETTER_PAIRS. */
  lookAlikes: [string, string][];
  /** Which form the look-alike round shows: English shows lowercase ('secondary'), where b/d/p/q live. */
  lookAlikeForm: 'primary' | 'secondary';
  rounds: {
    /** Catch-letters-in-order-then-blend. Null disables it. */
    blend: { words: BlendWord[] } | null;
    /** Missing-piece storm. Null disables it. */
    missingPiece: MissingPieceRound | null;
    /** Odd-one-out sound storm — needs ≥2 words per letter sharing initialSound. */
    oddSound: boolean;
    rainbow: RainbowColorDef[];
    /** "Hear the name, pick the plane". */
    planeChoice: boolean;
  };
  /**
   * Spoken lines the game says outside letters/words (round prompts, the
   * Nest's summary). Keys are shared across packs — every key in the
   * English pack must exist here (validate.mjs checks). `{name}`
   * placeholders are filled at runtime; counted lines use plural
   * categories chosen with Intl.PluralRules(code) (Arabic needs all six).
   */
  phrases: Record<string, Phrase>;
}

/** A spoken line: plain text, or per-plural-category text for a line with a `{count}`. */
export type Phrase = string | ({ other: string } & Partial<Record<'zero' | 'one' | 'two' | 'few' | 'many', string>>);
