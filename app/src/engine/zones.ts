import type { LetterProgress } from '../types';
import { ZONES, type Zone } from '../data/zones';

export function isZoneComplete(zone: Zone, letters: Record<string, LetterProgress>): boolean {
  return zone.letters.every((l) => (letters[l]?.box ?? 0) >= 4);
}

export function zoneProgress(zone: Zone, letters: Record<string, LetterProgress>): { mastered: number; total: number } {
  const mastered = zone.letters.filter((l) => (letters[l]?.box ?? 0) >= 4).length;
  return { mastered, total: zone.letters.length };
}

export function getZoneById(id: string): Zone | undefined {
  return ZONES.find((z) => z.id === id);
}
