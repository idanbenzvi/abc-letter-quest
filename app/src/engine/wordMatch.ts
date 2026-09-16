/**
 * Checks whether a transcribed word starts with the target letter.
 *
 * This is a SPELLING match, not a phonetic one — a known, documented
 * limitation (see docs/07-architecture.md#speech-to-text-bonus-word-challenge).
 * It will wrongly reject a phonetically-correct answer with an
 * irregular spelling (e.g. "city" for the /s/ sound, spelled with C)
 * and wrongly accept a spelling match that doesn't share the target
 * phoneme in rare cases. For a 6-year-old's mostly phonetically-regular
 * vocabulary this is right often enough to be useful, but the bonus
 * round's feedback design must stay forgiving because of this — never
 * treat a "no match" as proof the child was wrong.
 */
export function matchesLetter(transcript: string, letter: string): boolean {
  const firstWord = transcript.trim().split(/\s+/)[0] ?? '';
  const cleaned = firstWord.replace(/[^a-zA-Z]/g, '');
  return cleaned.length > 0 && cleaned[0].toUpperCase() === letter.toUpperCase();
}

/** Title-cases a transcript word for display (e.g. "dinosaur" -> "Dinosaur"). */
export function titleCaseWord(word: string): string {
  const cleaned = word.trim().split(/\s+/)[0] ?? '';
  if (!cleaned) return '';
  return cleaned[0].toUpperCase() + cleaned.slice(1).toLowerCase();
}
