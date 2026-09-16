/**
 * "Off-screen" albatross-themed activities for the Dashboard's carousel
 * (see Dashboard.tsx) — real-world play that echoes the in-game
 * mechanics (collecting letters into a nest, hearing a sound and
 * finding its letter) so a child recognizes the connection, using
 * nothing but paper and a bit of floor space. Not a replacement for the
 * game — a bridge from it back into everyday life, per the AAP's own
 * "purposeful, shared use" guidance (see data/research.ts).
 */
export interface OfflineActivity {
  id: string;
  title: string;
  tagline: string;
  steps: string[];
}

export const OFFLINE_ACTIVITIES: OfflineActivity[] = [
  {
    id: 'nest-hunt',
    title: 'Letter Nest Hunt',
    tagline: 'Just like in the game: fly around, find the letters, and carry them home to the nest.',
    steps: [
      "Write a handful of letters your child already knows on scraps of paper or sticky notes.",
      'Hide them around one room — or the whole house, if you\'re feeling brave.',
      'Give your child a basket or bowl to be "the nest."',
      'Child becomes the albatross — arms out, gliding from letter to letter.',
      "Before each letter goes in the nest, say its SOUND together, not just its name.",
    ],
  },
  {
    id: 'wingspan-walk',
    title: 'Wingspan Walk',
    tagline: "A real albatross's wings can stretch past 11 feet — wider than most hallways! Spread yours out and go exploring.",
    steps: [
      'Pick one letter and sound to hunt for, like "B."',
      'Arms out like wings, glide slowly from room to room.',
      'At each stop, look around and name one thing that starts with that sound.',
      'Switch letters — and switch who gets to be the albatross.',
    ],
  },
  {
    id: 'landing-strip',
    title: 'Landing Strip Sounds',
    tagline: 'Just like the planes in the game: listen for the sound, then land on the matching letter.',
    steps: [
      'Write 3-4 letters on separate sheets of paper and lay them on the floor like landing strips.',
      "A grown-up calls out a SOUND — not the letter's name — the way the game's planes do.",
      'Child hops onto the matching letter, plane-style.',
      'Got it right? Take off again for the next sound.',
    ],
  },
];
