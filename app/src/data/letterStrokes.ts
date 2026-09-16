// GENERATED FILE — do not hand-edit. Regenerate with:
//   node scripts/generate-letter-strokes.mjs
// Source: scripts/generate-letter-strokes.mjs. See
// docs/04-screens-spec.md#3-letter-learning and
// docs/07-architecture.md#letter-writing-animation for what this is for.
//
// Each letter maps to an array of stroke path strings — one array entry
// per pen stroke (no lifts within one string), in teaching stroke
// order. Coordinate system: viewBox "0 0 100 120", baseline y=100,
// cap/ascender top y=15, x-height top y=52, descender bottom y=116.

export interface LetterForm {
  strokes: string[];
}


const UPPER_STROKES: Record<string, string[]> = {
  "A": [
    "M26,100 L50,15 L74,100",
    "M36,65 L64,65",
  ],
  "B": [
    "M30,15 L30,100",
    "M30,15 Q68,15 68,36 Q68,57 30,57 Q70,57 70,78 Q70,100 30,100",
  ],
  "C": [
    "M69.7,33.1 A24,42.5 0 1,0 69.7,81.9",
  ],
  "D": [
    "M30,15 L30,100",
    "M30,15 Q76,15 76,57.5 Q76,100 30,100",
  ],
  "E": [
    "M30,15 L30,100",
    "M30,15 L70,15",
    "M30,57.5 L58,57.5",
    "M30,100 L70,100",
  ],
  "F": [
    "M30,15 L30,100",
    "M30,15 L70,15",
    "M30,57.5 L58,57.5",
  ],
  "G": [
    "M69.7,33.1 A24,42.5 0 1,0 69.7,81.9",
    "M70,82 L70,62 L50,62",
  ],
  "H": [
    "M30,15 L30,100",
    "M70,15 L70,100",
    "M30,57.5 L70,57.5",
  ],
  "I": [
    "M50,15 L50,100",
  ],
  "J": [
    "M62,15 L62,82 Q62,100 42,100 Q30,100 30,86",
  ],
  "K": [
    "M30,15 L30,100",
    "M68,15 L30,57.5",
    "M30,57.5 L68,100",
  ],
  "L": [
    "M30,15 L30,100 L70,100",
  ],
  "M": [
    "M24,100 L24,15 L50,55 L76,15 L76,100",
  ],
  "N": [
    "M26,100 L26,15 L74,100 L74,15",
  ],
  "O": [
    "M50,15 A24,42.5 0 1,1 50,100 A24,42.5 0 1,1 50,15",
  ],
  "P": [
    "M30,15 L30,100",
    "M30,15 Q72,15 72,37 Q72,58 30,58",
  ],
  "Q": [
    "M50,15 A24,42.5 0 1,1 50,100 A24,42.5 0 1,1 50,15",
    "M60,78 L80,102",
  ],
  "R": [
    "M30,15 L30,100",
    "M30,15 Q72,15 72,37 Q72,58 30,58",
    "M44,58 L72,100",
  ],
  "S": [
    "M68,32 Q68,15 50,15 Q30,15 30,33 Q30,48 50,57.5 Q70,67 70,83 Q70,100 50,100 Q30,100 30,84",
  ],
  "T": [
    "M24,15 L76,15",
    "M50,15 L50,100",
  ],
  "U": [
    "M30,15 L30,76 Q30,100 50,100 Q70,100 70,76 L70,15",
  ],
  "V": [
    "M24,15 L50,100 L76,15",
  ],
  "W": [
    "M18,15 L34,100 L50,52 L66,100 L82,15",
  ],
  "X": [
    "M28,15 L72,100",
    "M72,15 L28,100",
  ],
  "Y": [
    "M26,15 L50,55",
    "M74,15 L50,55 L50,100",
  ],
  "Z": [
    "M26,15 L74,15 L26,100 L74,100",
  ],
};

const LOWER_STROKES: Record<string, string[]> = {
  "a": [
    "M50,52 A20,24 0 1,1 50,100 A20,24 0 1,1 50,52",
    "M70,64 L70,100",
  ],
  "b": [
    "M30,15 L30,100",
    "M52,54 A18,22 0 1,1 52,98 A18,22 0 1,1 52,54",
  ],
  "c": [
    "M66.4,62.2 A20,24 0 1,0 66.4,89.8",
  ],
  "d": [
    "M50,52 A20,24 0 1,1 50,100 A20,24 0 1,1 50,52",
    "M70,15 L70,100",
  ],
  "e": [
    "M30,76 L68,76 Q68,52 50,52 Q30,52 30,79 Q30,100 50,100 Q64,100 68,90",
  ],
  "f": [
    "M62,15 Q40,15 40,34 L40,100",
    "M26,52 L58,52",
  ],
  "g": [
    "M50,52 A20,24 0 1,1 50,100 A20,24 0 1,1 50,52",
    "M70,76 L70,104 Q70,116 50,116 Q38,116 36,106",
  ],
  "h": [
    "M28,15 L28,100",
    "M28,68 Q28,52 46,52 Q64,52 64,68 L64,100",
  ],
  "i": [
    "M50,52 L50,100",
    "M50,40 L50,39",
  ],
  "j": [
    "M58,52 L58,104 Q58,116 40,116",
    "M58,40 L58,39",
  ],
  "k": [
    "M28,15 L28,100",
    "M62,52 L30,78",
    "M38,74 L64,100",
  ],
  "l": [
    "M50,15 L50,100",
  ],
  "m": [
    "M28,100 L28,52 Q28,52 44,52 Q54,52 54,68 L54,100",
    "M54,68 Q54,52 70,52 Q80,52 80,68 L80,100",
  ],
  "n": [
    "M30,100 L30,52 Q30,52 46,52 Q64,52 64,68 L64,100",
  ],
  "o": [
    "M50,52 A20,24 0 1,1 50,100 A20,24 0 1,1 50,52",
  ],
  "p": [
    "M30,52 L30,116",
    "M50,54 A18,22 0 1,1 50,98 A18,22 0 1,1 50,54",
  ],
  "q": [
    "M50,52 A20,24 0 1,1 50,100 A20,24 0 1,1 50,52",
    "M70,76 L70,110 Q70,116 78,116",
  ],
  "r": [
    "M30,52 L30,100",
    "M30,60 Q30,52 46,52 Q56,52 60,52",
  ],
  "s": [
    "M64,60 Q64,52 50,52 Q34,52 34,63 Q34,74 50,76 Q66,78 66,89 Q66,100 50,100 Q34,100 34,90",
  ],
  "t": [
    "M46,30 L46,100",
    "M28,52 L62,52",
  ],
  "u": [
    "M30,52 L30,86 Q30,100 46,100 Q62,100 62,86 L62,52",
  ],
  "v": [
    "M28,52 L50,100 L72,52",
  ],
  "w": [
    "M20,52 L33,100 L50,68 L67,100 L80,52",
  ],
  "x": [
    "M30,52 L70,100",
    "M70,52 L30,100",
  ],
  "y": [
    "M28,52 L50,82",
    "M72,52 L44,110 Q40,116 32,114",
  ],
  "z": [
    "M30,52 L70,52 L30,100 L70,100",
  ],
};

export const VIEW_BOX = '0 0 100 120';


export function getLetterForm(letter: string, isUpper: boolean): LetterForm {
  // Normalize casing here rather than trusting the caller — callers
  // naturally pass the letter in whatever case their own context uses
  // (LetterLearning tracks the curriculum letter as uppercase always).
  const key = isUpper ? letter.toUpperCase() : letter.toLowerCase();
  const strokes = (isUpper ? UPPER_STROKES : LOWER_STROKES)[key];
  if (!strokes) throw new Error(`No stroke data for ${isUpper ? 'uppercase' : 'lowercase'} "${letter}"`);
  return { strokes };
}
