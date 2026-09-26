import { FLASHCARDS } from '../data/flashcards';
import { initialSoundOf, CONFUSABLE_SOUNDS } from '../data/initialSounds';

export interface OddSoundRound {
  /** The three flash-card ids, in display order. */
  cardIds: string[];
  /** The one card whose first sound differs. */
  oddId: string;
  /** The sound the other two share, and the odd card's (keys from data/initialSounds.ts). */
  pairSound: string;
  oddSound: string;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function confusable(a: string, b: string): boolean {
  return CONFUSABLE_SOUNDS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/**
 * "Which one starts with a different sound?" — the storm round. The
 * classic odd-one-out sound-categorization task (Bradley & Bryant 1983,
 * the study that tied this exact skill to learning to read).
 *
 * The matching pair are two cards of the letter about to appear as a
 * cloud (`targetLetter`), so the round previews its sound. Returns null
 * when that letter can't make a fair pair — fewer than two of its cards
 * truly share a first sound (U: umbrella vs unicorn; X: xylophone vs
 * x-ray) — and the caller simply doesn't open a storm for it.
 *
 * The odd card comes from any other sound EXCEPT one too close to the
 * pair's to contrast fairly (see CONFUSABLE_SOUNDS) — never "Ball, Bear,
 * Pig".
 */
export function buildOddSoundRound(targetLetter: string): OddSoundRound | null {
  const letter = targetLetter.toUpperCase();
  const own = FLASHCARDS.filter((c) => c.letter === letter);
  const bySound = new Map<string, string[]>();
  for (const c of own) {
    const s = initialSoundOf(c.id);
    bySound.set(s, [...(bySound.get(s) ?? []), c.id]);
  }
  const pairGroup = [...bySound.entries()].find(([, ids]) => ids.length >= 2);
  if (!pairGroup) return null;
  const [pairSound, pairIds] = pairGroup;
  const pair = shuffle(pairIds).slice(0, 2);

  const oddPool = FLASHCARDS.filter((c) => {
    const s = initialSoundOf(c.id);
    return s && s !== pairSound && !confusable(s, pairSound);
  });
  if (oddPool.length === 0) return null;
  const odd = oddPool[Math.floor(Math.random() * oddPool.length)];

  return { cardIds: shuffle([...pair, odd.id]), oddId: odd.id, pairSound, oddSound: initialSoundOf(odd.id) };
}
