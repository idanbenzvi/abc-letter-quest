import type { WordEntry } from '../types';

// A larger pool per letter (not just one) so practice doesn't show the
// same word every time — see engine/wordBank.ts for how a word is
// picked per session, and docs/09-roadmap.md for the icon-coverage
// tradeoff this accepts: only apple/ball/cat/dog/elephant/fish have
// hand-built illustrations so far (docs/08-asset-pipeline.md), the rest
// render via WordIcon's generic fallback until more are hand-built or
// AI-generated. All words for one letter share that letter's canonical
// initial phoneme — the quiz/distractor logic depends on that.
export const WORDS: WordEntry[] = [
  // A /æ/
  { id: 'apple', letter: 'A', word: 'Apple', phoneme: '/æ/' },
  { id: 'ant', letter: 'A', word: 'Ant', phoneme: '/æ/' },
  { id: 'alligator', letter: 'A', word: 'Alligator', phoneme: '/æ/' },
  { id: 'astronaut', letter: 'A', word: 'Astronaut', phoneme: '/æ/' },
  // B /b/
  { id: 'ball', letter: 'B', word: 'Ball', phoneme: '/b/' },
  { id: 'banana', letter: 'B', word: 'Banana', phoneme: '/b/' },
  { id: 'bear', letter: 'B', word: 'Bear', phoneme: '/b/' },
  { id: 'butterfly', letter: 'B', word: 'Butterfly', phoneme: '/b/' },
  // C /k/
  { id: 'cat', letter: 'C', word: 'Cat', phoneme: '/k/' },
  { id: 'cake', letter: 'C', word: 'Cake', phoneme: '/k/' },
  { id: 'car', letter: 'C', word: 'Car', phoneme: '/k/' },
  { id: 'caterpillar', letter: 'C', word: 'Caterpillar', phoneme: '/k/' },
  // D /d/
  { id: 'dog', letter: 'D', word: 'Dog', phoneme: '/d/' },
  { id: 'duck', letter: 'D', word: 'Duck', phoneme: '/d/' },
  { id: 'drum', letter: 'D', word: 'Drum', phoneme: '/d/' },
  { id: 'dinosaur', letter: 'D', word: 'Dinosaur', phoneme: '/d/' },
  // E /ɛ/
  { id: 'elephant', letter: 'E', word: 'Elephant', phoneme: '/ɛ/' },
  { id: 'egg', letter: 'E', word: 'Egg', phoneme: '/ɛ/' },
  { id: 'engine', letter: 'E', word: 'Engine', phoneme: '/ɛ/' },
  // F /f/
  { id: 'fish', letter: 'F', word: 'Fish', phoneme: '/f/' },
  { id: 'frog', letter: 'F', word: 'Frog', phoneme: '/f/' },
  { id: 'firetruck', letter: 'F', word: 'Fire Truck', phoneme: '/f/' },
  { id: 'feather', letter: 'F', word: 'Feather', phoneme: '/f/' },
  // G /g/
  { id: 'goat', letter: 'G', word: 'Goat', phoneme: '/g/' },
  { id: 'grapes', letter: 'G', word: 'Grapes', phoneme: '/g/' },
  { id: 'guitar', letter: 'G', word: 'Guitar', phoneme: '/g/' },
  { id: 'giraffe', letter: 'G', word: 'Giraffe', phoneme: '/g/' },
  // H /h/
  { id: 'hat', letter: 'H', word: 'Hat', phoneme: '/h/' },
  { id: 'horse', letter: 'H', word: 'Horse', phoneme: '/h/' },
  { id: 'house', letter: 'H', word: 'House', phoneme: '/h/' },
  { id: 'honey', letter: 'H', word: 'Honey', phoneme: '/h/' },
  // I /ɪ/
  { id: 'igloo', letter: 'I', word: 'Igloo', phoneme: '/ɪ/' },
  { id: 'insect', letter: 'I', word: 'Insect', phoneme: '/ɪ/' },
  { id: 'iguana', letter: 'I', word: 'Iguana', phoneme: '/ɪ/' },
  // J /dʒ/
  { id: 'jam', letter: 'J', word: 'Jam', phoneme: '/dʒ/' },
  { id: 'jellyfish', letter: 'J', word: 'Jellyfish', phoneme: '/dʒ/' },
  { id: 'juice', letter: 'J', word: 'Juice', phoneme: '/dʒ/' },
  { id: 'jacket', letter: 'J', word: 'Jacket', phoneme: '/dʒ/' },
  // K /k/
  { id: 'kite', letter: 'K', word: 'Kite', phoneme: '/k/' },
  { id: 'koala', letter: 'K', word: 'Koala', phoneme: '/k/' },
  { id: 'key', letter: 'K', word: 'Key', phoneme: '/k/' },
  { id: 'kangaroo', letter: 'K', word: 'Kangaroo', phoneme: '/k/' },
  // L /l/
  { id: 'lion', letter: 'L', word: 'Lion', phoneme: '/l/' },
  { id: 'leaf', letter: 'L', word: 'Leaf', phoneme: '/l/' },
  { id: 'lamp', letter: 'L', word: 'Lamp', phoneme: '/l/' },
  { id: 'ladybug', letter: 'L', word: 'Ladybug', phoneme: '/l/' },
  // M /m/
  { id: 'moon', letter: 'M', word: 'Moon', phoneme: '/m/' },
  { id: 'monkey', letter: 'M', word: 'Monkey', phoneme: '/m/' },
  { id: 'mouse', letter: 'M', word: 'Mouse', phoneme: '/m/' },
  { id: 'mushroom', letter: 'M', word: 'Mushroom', phoneme: '/m/' },
  // N /n/
  { id: 'nest', letter: 'N', word: 'Nest', phoneme: '/n/' },
  { id: 'nut', letter: 'N', word: 'Nut', phoneme: '/n/' },
  { id: 'necklace', letter: 'N', word: 'Necklace', phoneme: '/n/' },
  { id: 'noodle', letter: 'N', word: 'Noodle', phoneme: '/n/' },
  // O /ɒ/
  { id: 'octopus', letter: 'O', word: 'Octopus', phoneme: '/ɒ/' },
  { id: 'orange', letter: 'O', word: 'Orange', phoneme: '/ɒ/' },
  { id: 'ostrich', letter: 'O', word: 'Ostrich', phoneme: '/ɒ/' },
  // P /p/
  { id: 'pig', letter: 'P', word: 'Pig', phoneme: '/p/' },
  { id: 'pumpkin', letter: 'P', word: 'Pumpkin', phoneme: '/p/' },
  { id: 'panda', letter: 'P', word: 'Panda', phoneme: '/p/' },
  { id: 'popcorn', letter: 'P', word: 'Popcorn', phoneme: '/p/' },
  // Q /kw/
  { id: 'queen', letter: 'Q', word: 'Queen', phoneme: '/kw/' },
  { id: 'quilt', letter: 'Q', word: 'Quilt', phoneme: '/kw/' },
  // R /r/
  { id: 'rabbit', letter: 'R', word: 'Rabbit', phoneme: '/r/' },
  { id: 'rainbow', letter: 'R', word: 'Rainbow', phoneme: '/r/' },
  { id: 'robot', letter: 'R', word: 'Robot', phoneme: '/r/' },
  { id: 'rocket', letter: 'R', word: 'Rocket', phoneme: '/r/' },
  // S /s/
  { id: 'sun', letter: 'S', word: 'Sun', phoneme: '/s/' },
  { id: 'snail', letter: 'S', word: 'Snail', phoneme: '/s/' },
  { id: 'star', letter: 'S', word: 'Star', phoneme: '/s/' },
  { id: 'snake', letter: 'S', word: 'Snake', phoneme: '/s/' },
  // T /t/
  { id: 'tiger', letter: 'T', word: 'Tiger', phoneme: '/t/' },
  { id: 'turtle', letter: 'T', word: 'Turtle', phoneme: '/t/' },
  { id: 'train', letter: 'T', word: 'Train', phoneme: '/t/' },
  { id: 'tomato', letter: 'T', word: 'Tomato', phoneme: '/t/' },
  // U /ʌ/
  { id: 'umbrella', letter: 'U', word: 'Umbrella', phoneme: '/ʌ/' },
  { id: 'unicorn', letter: 'U', word: 'Unicorn', phoneme: '/ʌ/' },
  // V /v/
  { id: 'van', letter: 'V', word: 'Van', phoneme: '/v/' },
  { id: 'violin', letter: 'V', word: 'Violin', phoneme: '/v/' },
  { id: 'volcano', letter: 'V', word: 'Volcano', phoneme: '/v/' },
  // W /w/
  { id: 'whale', letter: 'W', word: 'Whale', phoneme: '/w/' },
  { id: 'watermelon', letter: 'W', word: 'Watermelon', phoneme: '/w/' },
  { id: 'worm', letter: 'W', word: 'Worm', phoneme: '/w/' },
  // X /z/ (initial-sound simplification — see docs/02-pedagogy.md)
  { id: 'xylophone', letter: 'X', word: 'Xylophone', phoneme: '/z/' },
  { id: 'xray', letter: 'X', word: 'X-ray', phoneme: '/z/' },
  // Y /j/
  { id: 'yoyo', letter: 'Y', word: 'Yoyo', phoneme: '/j/' },
  { id: 'yak', letter: 'Y', word: 'Yak', phoneme: '/j/' },
  { id: 'yarn', letter: 'Y', word: 'Yarn', phoneme: '/j/' },
  // Z /z/
  { id: 'zebra', letter: 'Z', word: 'Zebra', phoneme: '/z/' },
  { id: 'zipper', letter: 'Z', word: 'Zipper', phoneme: '/z/' },
];

export const WORDS_BY_LETTER: Record<string, WordEntry[]> = WORDS.reduce(
  (acc, w) => {
    (acc[w.letter] ??= []).push(w);
    return acc;
  },
  {} as Record<string, WordEntry[]>,
);
