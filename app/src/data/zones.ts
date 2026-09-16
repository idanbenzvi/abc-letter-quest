import { CURRICULUM_ORDER } from './curriculum';

export interface Companion {
  id: string;
  name: string;
  blurb: string;
}

export interface Zone {
  id: string;
  name: string;
  letters: string[];
  /** design-system accent token, e.g. 'var(--leaf)' — see docs/03-design-system.md */
  accent: string;
  accentDark: string;
  accentWash: string;
  companion: Companion;
}

// The alphabet split into four story chapters. Grouping is a narrative
// device, not a pedagogical one — the underlying letter curriculum
// order and reachability rules are unchanged (docs/05-spaced-repetition.md);
// a zone is "complete" once every one of its letters reaches mastery
// box 4, which unlocks that zone's companion. See
// docs/04-screens-spec.md#world-map for the full spec.
export const ZONES: Zone[] = [
  {
    id: 'whisper-woods',
    name: 'Whisper Woods',
    letters: CURRICULUM_ORDER.slice(0, 6), // A-F
    accent: 'var(--leaf)',
    accentDark: 'var(--leaf-dark)',
    accentWash: 'var(--leaf-wash)',
    companion: {
      id: 'fern',
      name: 'Fern the Bunny',
      blurb: "Fern remembered the woodland verse of Buddy's song — and wants to hop along with you!",
    },
  },
  {
    id: 'sunny-meadow',
    name: 'Sunny Meadow',
    letters: CURRICULUM_ORDER.slice(6, 12), // G-L
    accent: 'var(--sun)',
    accentDark: 'var(--sun-dark)',
    accentWash: 'var(--sun-wash)',
    companion: {
      id: 'buzz',
      name: 'Buzz the Bee',
      blurb: "Buzz hums the meadow melody all day long — now she's buzzing along on your journey!",
    },
  },
  {
    id: 'sparkle-shore',
    name: 'Sparkle Shore',
    letters: CURRICULUM_ORDER.slice(12, 18), // M-R
    accent: 'var(--sky)',
    accentDark: 'var(--sky-dark)',
    accentWash: 'var(--sky-wash)',
    companion: {
      id: 'splash',
      name: 'Splash the Otter',
      blurb: "Splash kept the shore's tune safe underwater — and can't wait to swim alongside you!",
    },
  },
  {
    id: 'starlight-peak',
    name: 'Starlight Peak',
    letters: CURRICULUM_ORDER.slice(18, 26), // S-Z
    accent: 'var(--berry)',
    accentDark: 'var(--berry)',
    accentWash: 'var(--berry-wash)',
    companion: {
      id: 'nova',
      name: 'Nova the Firefly',
      blurb: "Nova lit up the night with the last verse of the song — now she'll light your path too!",
    },
  },
];

export const ZONE_BY_LETTER: Record<string, Zone> = Object.fromEntries(
  ZONES.flatMap((zone) => zone.letters.map((letter) => [letter, zone])),
);
