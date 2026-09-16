import type { LetterProgress, ReadingLevel } from '../types';
import { CURRICULUM_ORDER } from '../data/curriculum';
import type { QueueItem } from '../three/flightTypes';

// See docs/10-flight-game.md#letter-selection--case-progression.
const BASE_POOL_SIZE = 6;
export const MISSION_LENGTH = 6;

/**
 * Grows the letter pool by one for every letter the child has mastered
 * — "6 letters ... growing as letters are mastered." Only meaningful for
 * a child with no prior knowledge (onboarding's "Just starting out"): a
 * true beginner should meet the alphabet as a slow batch-by-batch drip
 * fed by their own success, A first, Z last, never a letter from
 * nowhere in the middle before they're ready for it. A child who picked
 * "I know some letters" or "I can already read!" already has some real
 * prior knowledge to review — gating them the same way as a total
 * beginner would mean weeks of only ever seeing A-F regardless of what
 * they actually already know, so they get the full alphabet as their
 * pool from the start (spaced-repetition still governs which of those
 * come up most, via reviewGap/box — see scheduler.ts).
 */
export function computePoolSize(letters: Record<string, LetterProgress>, readingLevel?: ReadingLevel): number {
  if (readingLevel && readingLevel !== 'starting') return 26;
  const masteredCount = Object.values(letters).filter((l) => l.box >= 4).length;
  return Math.min(26, BASE_POOL_SIZE + masteredCount);
}

/**
 * Chance a letter shows lowercase instead of uppercase, "based on
 * success rate": box 0-1 (new/shaky) never — box 2 (review) sometimes,
 * ramping to always by box 4 (mastered). Uppercase recognition has to
 * be reasonably solid before lowercase is thrown in at all.
 */
function lowercaseChance(box: number): number {
  return Math.max(0, Math.min(1, (box - 1) / 3));
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildQueueItem(letter: string, letters: Record<string, LetterProgress>): QueueItem {
  const box = letters[letter]?.box ?? 0;
  const isLower = Math.random() < lowercaseChance(box);
  return { canonicalLetter: letter, displayChar: isLower ? letter.toLowerCase() : letter };
}

/** Builds one mission's letter queue: a random order drawn from the current pool, each randomly cased per its own mastery. */
export function buildMissionQueue(letters: Record<string, LetterProgress>, length = MISSION_LENGTH, readingLevel?: ReadingLevel): QueueItem[] {
  const poolSize = computePoolSize(letters, readingLevel);
  const pool = CURRICULUM_ORDER.slice(0, poolSize);
  const chosen = shuffle(pool).slice(0, Math.min(length, pool.length));
  return chosen.map((letter) => buildQueueItem(letter, letters));
}

/**
 * One random letter from the current pool — for endless mode, which has
 * no fixed round length, so repeats across a session are expected (and
 * fine: it's still spaced-repetition-aware since the pool itself is
 * driven by real mastery, same as a classic mission).
 */
export function pickEndlessItem(letters: Record<string, LetterProgress>, readingLevel?: ReadingLevel): QueueItem {
  const poolSize = computePoolSize(letters, readingLevel);
  const pool = CURRICULUM_ORDER.slice(0, poolSize);
  const letter = pool[Math.floor(Math.random() * pool.length)];
  return buildQueueItem(letter, letters);
}
