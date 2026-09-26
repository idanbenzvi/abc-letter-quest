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

/**
 * Share of a flight given to the grown-ups' focus letters (settings.focusLetters)
 * when any are set. Half, not all: the rest of the alphabet still needs
 * its spaced-repetition reviews, and a flight of nothing but b/d/b/d
 * would be a drill, not a game.
 */
export const FOCUS_SHARE = 0.5;

/** Shuffle, then nudge apart any identical neighbours (a focus letter can repeat) where possible. */
function spreadOut(arr: string[]): string[] {
  const out = shuffle(arr);
  for (let i = 1; i < out.length; i++) {
    if (out[i] !== out[i - 1]) continue;
    const j = out.findIndex((l, k) => k > i && l !== out[i]);
    if (j !== -1) [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Builds one mission's letter queue: a random order drawn from the current pool, each randomly cased per its own mastery.
 * With focus letters set, about FOCUS_SHARE of the queue is drawn from them — regardless of the curriculum pool,
 * since a grown-up picked them deliberately (the week's letters at school, a stubborn b/d) — repeating them if
 * there are fewer focus letters than slots.
 */
export function buildMissionQueue(letters: Record<string, LetterProgress>, length = MISSION_LENGTH, readingLevel?: ReadingLevel, focus: string[] = []): QueueItem[] {
  const poolSize = computePoolSize(letters, readingLevel);
  const pool = CURRICULUM_ORDER.slice(0, poolSize);
  if (focus.length === 0) {
    const chosen = shuffle(pool).slice(0, Math.min(length, pool.length));
    return chosen.map((letter) => buildQueueItem(letter, letters));
  }
  const focusCount = Math.max(1, Math.round(length * FOCUS_SHARE));
  const focusOrder = shuffle(focus);
  const picked = Array.from({ length: focusCount }, (_, i) => focusOrder[i % focusOrder.length]);
  const rest = shuffle(pool.filter((l) => !focus.includes(l))).slice(0, length - focusCount);
  // A tiny pool (a brand-new player) can't fill the rest — top up with more focus letters.
  while (picked.length + rest.length < length) picked.push(focusOrder[picked.length % focusOrder.length]);
  return spreadOut([...picked, ...rest]).map((letter) => buildQueueItem(letter, letters));
}

/**
 * The "My Name" flight: the letters of the child's own name, in order,
 * shown in the case they're written in the name (Mia → M, i, a). Letters
 * of their own name are the ones children reliably learn first — and
 * it's the most personal thing the game can spell. Non-English letters
 * are skipped; an empty result means the name can't be flown (the mode
 * is disabled for it).
 */
export const NAME_FLIGHT_MAX = 12;
export function buildNameQueue(name: string): QueueItem[] {
  // The first name only ("Noa Levi" → Noa, "Anna-Lee Cohen" → AnnaLee):
  // a whole full name is too long a flight, and cutting one off at a
  // letter count would stop mid-word. The cap is only a safety net.
  const first = name.split(/\s+/).find((word) => /[A-Za-z]/.test(word)) ?? '';
  return [...first]
    .filter((ch) => /[A-Za-z]/.test(ch))
    .slice(0, NAME_FLIGHT_MAX)
    .map((ch) => ({ canonicalLetter: ch.toUpperCase(), displayChar: ch }));
}

/**
 * One random letter from the current pool — for endless mode, which has
 * no fixed round length, so repeats across a session are expected (and
 * fine: it's still spaced-repetition-aware since the pool itself is
 * driven by real mastery, same as a classic mission).
 */
export function pickEndlessItem(letters: Record<string, LetterProgress>, readingLevel?: ReadingLevel, focus: string[] = []): QueueItem {
  if (focus.length > 0 && Math.random() < FOCUS_SHARE) {
    return buildQueueItem(focus[Math.floor(Math.random() * focus.length)], letters);
  }
  const poolSize = computePoolSize(letters, readingLevel);
  const pool = CURRICULUM_ORDER.slice(0, poolSize);
  const letter = pool[Math.floor(Math.random() * pool.length)];
  return buildQueueItem(letter, letters);
}
