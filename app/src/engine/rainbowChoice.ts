export interface RainbowColor {
  id: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';
  word: string;
  hex: string;
}

/**
 * Outermost band first, same order as a real rainbow. Six bands, not
 * the classic seven: indigo vs. violet is a distinction most 4-6 year
 * olds can't reliably see (or name), so it'd just be a coin-flip round.
 * Every colour word starts with a letter in the curriculum — that's
 * what lets buildRainbowRound tie the round back to the letter it's
 * interrupting when it can.
 */
export const RAINBOW_COLORS: RainbowColor[] = [
  { id: 'red', word: 'Red', hex: '#e8453c' },
  { id: 'orange', word: 'Orange', hex: '#f39a2b' },
  { id: 'yellow', word: 'Yellow', hex: '#f7d23e' },
  { id: 'green', word: 'Green', hex: '#4cb963' },
  { id: 'blue', word: 'Blue', hex: '#3d8fe0' },
  { id: 'purple', word: 'Purple', hex: '#9b5fd0' },
];

export interface RainbowRound {
  /** Index into RAINBOW_COLORS of the band that breathes/glows. */
  glowIndex: number;
  /** Colour ids offered as answers, in display order. */
  options: RainbowColor['id'][];
  /** True once the right swatch was picked — locks further taps during the celebration beat. */
  solved: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Red/green is the most common colour-blind confusion (~1 in 12 boys) —
// never offered side by side, same reasoning as PlaneChoice's palette.
function clashes(a: RainbowColor['id'], b: RainbowColor['id']): boolean {
  return (a === 'red' && b === 'green') || (a === 'green' && b === 'red');
}

/**
 * "Which colour is glowing?" — the streak reward round (see
 * FlightGameScreen's RAINBOW_STREAK). When the letter it's interrupting
 * starts a colour word (R, O, Y, G, B, P) that colour is the one that
 * glows, so the reward still lands on the letter the child is about to
 * meet; otherwise any colour. Two distractors, never a red+green pair
 * anywhere among the three options.
 */
export function buildRainbowRound(preferLetter?: string): RainbowRound {
  const matching = preferLetter ? RAINBOW_COLORS.findIndex((c) => c.word[0] === preferLetter.toUpperCase()) : -1;
  const glowIndex = matching >= 0 ? matching : Math.floor(Math.random() * RAINBOW_COLORS.length);
  const target = RAINBOW_COLORS[glowIndex].id;
  const distractors: RainbowColor['id'][] = [];
  for (const c of shuffle(RAINBOW_COLORS)) {
    if (distractors.length === 2) break;
    if (c.id === target) continue;
    if ([target, ...distractors].some((picked) => clashes(picked, c.id))) continue;
    distractors.push(c.id);
  }
  return { glowIndex, options: shuffle([target, ...distractors]), solved: false };
}
