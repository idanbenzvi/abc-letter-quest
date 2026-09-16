import { CURRICULUM_ORDER } from '../data/curriculum';

export interface PlaneChoiceRound {
  /** Canonical (always uppercase) letter this round is testing. */
  letter: string;
  /** Display-cased options, one per plane, in random order. */
  options: string[];
  /** Which display-cased option is the correct one to tap. */
  target: string;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * "Hear the letter's name, pick the matching plane" — the reverse-
 * direction bonus round (see three/PlaneChoice.tsx). Every other
 * encounter path in this game starts from a visible glyph and asks the
 * child to produce/confirm its name; this one starts from the spoken
 * name and asks them to find the glyph, which is the other half of the
 * name<->symbol mapping.
 *
 * Two distractor letters are picked at random from the full alphabet
 * (not narrowed to letters already mastered/in-curriculum-so-far) —
 * unlike the cloud queue itself, this round doesn't need to respect
 * spaced-repetition pacing since it's testing recognition of a letter
 * the child is already being shown elsewhere in the same mission; any
 * two OTHER letters make valid, unambiguous wrong answers. Every option
 * is case-matched to however the target is currently displayed (its own
 * mastery-driven upper/lowercase — see flightMission.ts's
 * lowercaseChance) so the three planes don't mix cases within one round.
 */
export function buildPlaneChoiceRound(canonicalLetter: string, displayChar: string): PlaneChoiceRound {
  const isLower = displayChar !== canonicalLetter;
  const toDisplay = (l: string) => (isLower ? l.toLowerCase() : l);
  const pool = CURRICULUM_ORDER.filter((l) => l !== canonicalLetter);
  const distractors = shuffle([...pool]).slice(0, 2);
  const target = toDisplay(canonicalLetter);
  const options = shuffle([target, ...distractors.map(toDisplay)]);
  return { letter: canonicalLetter, options, target };
}
