/**
 * Letter pairs young readers commonly mix up by SHAPE, not sound — the
 * classic early-literacy reversal/look-alike confusions (b/d/p/q from
 * mirror-flipping a vertical stroke's stem, m/w and n/u from flipping
 * top-to-bottom, h/n from a near-identical rounded hump). Deliberately
 * lowercase-only: these letters aren't confusable in their uppercase
 * forms (B/D/P/Q/M/W/N/U/H are all visually distinct) — the confusion
 * is specifically a lowercase-glyph problem, so three/LetterMatchup.tsx
 * always shows both letters in lowercase regardless of which case the
 * child's current mastery level would normally display.
 */
export const CONFUSABLE_LETTER_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['b', 'd'],
  ['b', 'p'],
  ['d', 'q'],
  ['p', 'q'],
  ['m', 'w'],
  ['n', 'u'],
  ['h', 'n'],
];

/** Every letter this canonical (uppercase) letter is known to be confused with, lowercase. Empty for a letter with no curated look-alike (most of the alphabet). */
export function confusablePartnersFor(canonicalLetter: string): string[] {
  const l = canonicalLetter.toLowerCase();
  const partners = new Set<string>();
  for (const [a, b] of CONFUSABLE_LETTER_PAIRS) {
    if (a === l) partners.add(b);
    if (b === l) partners.add(a);
  }
  return Array.from(partners);
}
