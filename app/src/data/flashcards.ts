// flashcards.ts
// Metadata and word mappings for all 72 flash cards spanning letters A through Z.

export interface FlashCardDef {
  id: string;
  letter: string;
  word: string;
  iconPath: string;
  cardPath: string;
  revealedCardPath?: string;
}

export const FLASHCARDS: FlashCardDef[] = [
  // A
  { id: 'apple', letter: 'A', word: 'Apple', iconPath: '/art/flashcards/apple.svg', cardPath: '/art/flashcards/apple-card.svg' },
  { id: 'ant', letter: 'A', word: 'Ant', iconPath: '/art/flashcards/ant.svg', cardPath: '/art/flashcards/ant-card.svg' },
  { id: 'alligator', letter: 'A', word: 'Alligator', iconPath: '/art/flashcards/alligator.svg', cardPath: '/art/flashcards/alligator-card.svg' },

  // B
  { id: 'ball', letter: 'B', word: 'Ball', iconPath: '/art/flashcards/ball.svg', cardPath: '/art/flashcards/ball-card.svg' },
  { id: 'banana', letter: 'B', word: 'Banana', iconPath: '/art/flashcards/banana.svg', cardPath: '/art/flashcards/banana-card.svg' },
  { id: 'bear', letter: 'B', word: 'Bear', iconPath: '/art/flashcards/bear.svg', cardPath: '/art/flashcards/bear-card.svg' },

  // C
  { id: 'cat', letter: 'C', word: 'Cat', iconPath: '/art/flashcards/cat.svg', cardPath: '/art/flashcards/cat-card.svg' },
  { id: 'cake', letter: 'C', word: 'Cake', iconPath: '/art/flashcards/cake.svg', cardPath: '/art/flashcards/cake-card.svg' },
  { id: 'car', letter: 'C', word: 'Car', iconPath: '/art/flashcards/car.svg', cardPath: '/art/flashcards/car-card.svg' },

  // D
  { id: 'dog', letter: 'D', word: 'Dog', iconPath: '/art/flashcards/dog.svg', cardPath: '/art/flashcards/dog-card.svg' },
  { id: 'duck', letter: 'D', word: 'Duck', iconPath: '/art/flashcards/duck.svg', cardPath: '/art/flashcards/duck-card.svg' },
  { id: 'drum', letter: 'D', word: 'Drum', iconPath: '/art/flashcards/drum.svg', cardPath: '/art/flashcards/drum-card.svg' },

  // E
  { id: 'elephant', letter: 'E', word: 'Elephant', iconPath: '/art/flashcards/elephant.svg', cardPath: '/art/flashcards/elephant-card.svg' },
  { id: 'egg', letter: 'E', word: 'Egg', iconPath: '/art/flashcards/egg.svg', cardPath: '/art/flashcards/egg-card.svg' },

  // F
  { id: 'fish', letter: 'F', word: 'Fish', iconPath: '/art/flashcards/fish.svg', cardPath: '/art/flashcards/fish-card.svg' },
  { id: 'frog', letter: 'F', word: 'Frog', iconPath: '/art/flashcards/frog.svg', cardPath: '/art/flashcards/frog-card.svg' },
  { id: 'feather', letter: 'F', word: 'Feather', iconPath: '/art/flashcards/feather.svg', cardPath: '/art/flashcards/feather-card.svg' },

  // G
  { id: 'goat', letter: 'G', word: 'Goat', iconPath: '/art/flashcards/goat.svg', cardPath: '/art/flashcards/goat-card.svg' },
  { id: 'grapes', letter: 'G', word: 'Grapes', iconPath: '/art/flashcards/grapes.svg', cardPath: '/art/flashcards/grapes-card.svg' },
  { id: 'guitar', letter: 'G', word: 'Guitar', iconPath: '/art/flashcards/guitar.svg', cardPath: '/art/flashcards/guitar-card.svg' },

  // H
  { id: 'hat', letter: 'H', word: 'Hat', iconPath: '/art/flashcards/hat.svg', cardPath: '/art/flashcards/hat-card.svg' },
  { id: 'horse', letter: 'H', word: 'Horse', iconPath: '/art/flashcards/horse.svg', cardPath: '/art/flashcards/horse-card.svg' },
  { id: 'house', letter: 'H', word: 'House', iconPath: '/art/flashcards/house.svg', cardPath: '/art/flashcards/house-card.svg' },

  // I
  { id: 'igloo', letter: 'I', word: 'Igloo', iconPath: '/art/flashcards/igloo.svg', cardPath: '/art/flashcards/igloo-card.svg' },
  { id: 'insect', letter: 'I', word: 'Insect', iconPath: '/art/flashcards/insect.svg', cardPath: '/art/flashcards/insect-card.svg' },

  // J
  { id: 'jam', letter: 'J', word: 'Jam', iconPath: '/art/flashcards/jam.svg', cardPath: '/art/flashcards/jam-card.svg' },
  { id: 'jellyfish', letter: 'J', word: 'Jellyfish', iconPath: '/art/flashcards/jellyfish.svg', cardPath: '/art/flashcards/jellyfish-card.svg' },
  { id: 'juice', letter: 'J', word: 'Juice', iconPath: '/art/flashcards/juice.svg', cardPath: '/art/flashcards/juice-card.svg' },

  // K
  { id: 'kite', letter: 'K', word: 'Kite', iconPath: '/art/flashcards/kite.svg', cardPath: '/art/flashcards/kite-card.svg' },
  { id: 'key', letter: 'K', word: 'Key', iconPath: '/art/flashcards/key.svg', cardPath: '/art/flashcards/key-card.svg' },
  { id: 'kangaroo', letter: 'K', word: 'Kangaroo', iconPath: '/art/flashcards/kangaroo.svg', cardPath: '/art/flashcards/kangaroo-card.svg' },

  // L
  { id: 'lion', letter: 'L', word: 'Lion', iconPath: '/art/flashcards/lion.svg', cardPath: '/art/flashcards/lion-card.svg' },
  { id: 'leaf', letter: 'L', word: 'Leaf', iconPath: '/art/flashcards/leaf.svg', cardPath: '/art/flashcards/leaf-card.svg' },
  { id: 'lamp', letter: 'L', word: 'Lamp', iconPath: '/art/flashcards/lamp.svg', cardPath: '/art/flashcards/lamp-card.svg' },

  // M
  { id: 'moon', letter: 'M', word: 'Moon', iconPath: '/art/flashcards/moon.svg', cardPath: '/art/flashcards/moon-card.svg' },
  { id: 'mouse', letter: 'M', word: 'Mouse', iconPath: '/art/flashcards/mouse.svg', cardPath: '/art/flashcards/mouse-card.svg' },
  { id: 'mushroom', letter: 'M', word: 'Mushroom', iconPath: '/art/flashcards/mushroom.svg', cardPath: '/art/flashcards/mushroom-card.svg' },

  // N
  { id: 'nest', letter: 'N', word: 'Nest', iconPath: '/art/flashcards/nest.svg', cardPath: '/art/flashcards/nest-card.svg' },
  { id: 'nut', letter: 'N', word: 'Nut', iconPath: '/art/flashcards/nut.svg', cardPath: '/art/flashcards/nut-card.svg' },
  { id: 'necklace', letter: 'N', word: 'Necklace', iconPath: '/art/flashcards/necklace.svg', cardPath: '/art/flashcards/necklace-card.svg' },

  // O
  { id: 'octopus', letter: 'O', word: 'Octopus', iconPath: '/art/flashcards/octopus.svg', cardPath: '/art/flashcards/octopus-card.svg' },
  { id: 'orange', letter: 'O', word: 'Orange', iconPath: '/art/flashcards/orange.svg', cardPath: '/art/flashcards/orange-card.svg' },
  { id: 'ostrich', letter: 'O', word: 'Ostrich', iconPath: '/art/flashcards/ostrich.svg', cardPath: '/art/flashcards/ostrich-card.svg' },

  // P
  { id: 'pig', letter: 'P', word: 'Pig', iconPath: '/art/flashcards/pig.svg', cardPath: '/art/flashcards/pig-card.svg' },
  { id: 'pumpkin', letter: 'P', word: 'Pumpkin', iconPath: '/art/flashcards/pumpkin.svg', cardPath: '/art/flashcards/pumpkin-card.svg' },
  { id: 'panda', letter: 'P', word: 'Panda', iconPath: '/art/flashcards/panda.svg', cardPath: '/art/flashcards/panda-card.svg' },

  // Q
  { id: 'queen', letter: 'Q', word: 'Queen', iconPath: '/art/flashcards/queen.svg', cardPath: '/art/flashcards/queen-card.svg' },
  { id: 'quilt', letter: 'Q', word: 'Quilt', iconPath: '/art/flashcards/quilt.svg', cardPath: '/art/flashcards/quilt-card.svg' },

  // R
  { id: 'rabbit', letter: 'R', word: 'Rabbit', iconPath: '/art/flashcards/rabbit.svg', cardPath: '/art/flashcards/rabbit-card.svg' },
  { id: 'rainbow', letter: 'R', word: 'Rainbow', iconPath: '/art/flashcards/rainbow.svg', cardPath: '/art/flashcards/rainbow-card.svg' },
  { id: 'rocket', letter: 'R', word: 'Rocket', iconPath: '/art/flashcards/rocket.svg', cardPath: '/art/flashcards/rocket-card.svg' },

  // S
  { id: 'sun', letter: 'S', word: 'Sun', iconPath: '/art/flashcards/sun.svg', cardPath: '/art/flashcards/sun-card.svg' },
  { id: 'star', letter: 'S', word: 'Star', iconPath: '/art/flashcards/star.svg', cardPath: '/art/flashcards/star-card.svg' },
  { id: 'snail', letter: 'S', word: 'Snail', iconPath: '/art/flashcards/snail.svg', cardPath: '/art/flashcards/snail-card.svg' },

  // T
  { id: 'tiger', letter: 'T', word: 'Tiger', iconPath: '/art/flashcards/tiger.svg', cardPath: '/art/flashcards/tiger-card.svg' },
  { id: 'turtle', letter: 'T', word: 'Turtle', iconPath: '/art/flashcards/turtle.svg', cardPath: '/art/flashcards/turtle-card.svg' },
  { id: 'train', letter: 'T', word: 'Train', iconPath: '/art/flashcards/train.svg', cardPath: '/art/flashcards/train-card.svg' },

  // U
  { id: 'umbrella', letter: 'U', word: 'Umbrella', iconPath: '/art/flashcards/umbrella.svg', cardPath: '/art/flashcards/umbrella-card.svg' },
  { id: 'unicorn', letter: 'U', word: 'Unicorn', iconPath: '/art/flashcards/unicorn.svg', cardPath: '/art/flashcards/unicorn-card.svg' },

  // V
  { id: 'van', letter: 'V', word: 'Van', iconPath: '/art/flashcards/van.svg', cardPath: '/art/flashcards/van-card.svg' },
  { id: 'violin', letter: 'V', word: 'Violin', iconPath: '/art/flashcards/violin.svg', cardPath: '/art/flashcards/violin-card.svg' },
  { id: 'volcano', letter: 'V', word: 'Volcano', iconPath: '/art/flashcards/volcano.svg', cardPath: '/art/flashcards/volcano-card.svg' },

  // W
  { id: 'whale', letter: 'W', word: 'Whale', iconPath: '/art/flashcards/whale.svg', cardPath: '/art/flashcards/whale-card.svg' },
  { id: 'watermelon', letter: 'W', word: 'Watermelon', iconPath: '/art/flashcards/watermelon.svg', cardPath: '/art/flashcards/watermelon-card.svg' },
  { id: 'worm', letter: 'W', word: 'Worm', iconPath: '/art/flashcards/worm.svg', cardPath: '/art/flashcards/worm-card.svg' },

  // X
  { id: 'xylophone', letter: 'X', word: 'Xylophone', iconPath: '/art/flashcards/xylophone.svg', cardPath: '/art/flashcards/xylophone-card.svg' },
  { id: 'xray', letter: 'X', word: 'X-ray', iconPath: '/art/flashcards/xray.svg', cardPath: '/art/flashcards/xray-card.svg' },

  // Y
  { id: 'yoyo', letter: 'Y', word: 'Yoyo', iconPath: '/art/flashcards/yoyo.svg', cardPath: '/art/flashcards/yoyo-card.svg' },
  { id: 'yarn', letter: 'Y', word: 'Yarn', iconPath: '/art/flashcards/yarn.svg', cardPath: '/art/flashcards/yarn-card.svg' },
  { id: 'yak', letter: 'Y', word: 'Yak', iconPath: '/art/flashcards/yak.svg', cardPath: '/art/flashcards/yak-card.svg' },

  // Z
  { id: 'zebra', letter: 'Z', word: 'Zebra', iconPath: '/art/flashcards/zebra.svg', cardPath: '/art/flashcards/zebra-card.svg' },
  { id: 'zipper', letter: 'Z', word: 'Zipper', iconPath: '/art/flashcards/zipper.svg', cardPath: '/art/flashcards/zipper-card.svg' },
];

export const FLASHCARD_MAP: Record<string, FlashCardDef> = FLASHCARDS.reduce(
  (acc, card) => {
    acc[card.id] = card;
    return acc;
  },
  {} as Record<string, FlashCardDef>,
);

export const FLASHCARDS_BY_LETTER: Record<string, FlashCardDef[]> = FLASHCARDS.reduce(
  (acc, card) => {
    (acc[card.letter] ??= []).push(card);
    return acc;
  },
  {} as Record<string, FlashCardDef[]>,
);
