/**
 * 'glowing' is the short beat between a completed trace and the bubble
 * burst: the whole cloud (and the child's ribbon) lights up for a
 * moment as the reward for finishing the shape, then 'typed' takes over
 * and pops it — see FlightGameScreen's TRACE_GLOW_MS.
 */
export type EncounterStatus = 'pending' | 'active' | 'answered' | 'typed' | 'glowing' | 'passed' | 'gone';

export interface QueueItem {
  /** Always uppercase — the curriculum/scheduler key (LetterProgress is keyed by uppercase). */
  canonicalLetter: string;
  /** What's actually shown — upper or lower form, decided at mission-build time by case-progression. */
  displayChar: string;
}

export interface Encounter extends QueueItem {
  distance: number;
  laneX: number;
  status: EncounterStatus;
  /** Set once the child self-reports (status 'answered'): true = "Knew it!". Drives the cloud's gold tint; undefined until answered or for bonus solves (which burst instead). */
  knew?: boolean;
}
