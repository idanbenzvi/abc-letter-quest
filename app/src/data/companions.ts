/**
 * The companion flock: little creatures that join the albatross's
 * formation as letters are mastered (box >= 4) — the 3D ones fly in
 * three/CompanionFlock.tsx, the 2D ones perch in the kids' "My Nest"
 * screen (screens/Nest.tsx).
 */
export interface CompanionSpec {
  id: string;
  /** What the game calls it out loud ("…and a butterfly joins your flock!"). */
  name: string;
  /** Letters mastered before this one joins the flock. Spread across the 26-letter alphabet: an early win, then a slower trickle. */
  unlockAt: number;
  body: string;
  bodyLight: string;
  wing: string;
  stripes?: boolean;
}

export const COMPANIONS: CompanionSpec[] = [
  { id: 'firefly', name: 'firefly', unlockAt: 1, body: '#6b5b2e', bodyLight: '#ffe066', wing: '#fff4c2' },
  { id: 'bee', name: 'bee', unlockAt: 3, body: '#3a2a12', bodyLight: '#ffc233', wing: '#eaf6ff', stripes: true },
  { id: 'dragonfly', name: 'dragonfly', unlockAt: 6, body: '#1f6f6b', bodyLight: '#4fd8cf', wing: '#cdeeee' },
  { id: 'butterfly', name: 'butterfly', unlockAt: 10, body: '#6a2f8f', bodyLight: '#c98bf0', wing: '#f3d9ff' },
  { id: 'flying-fish', name: 'flying fish', unlockAt: 15, body: '#245a8f', bodyLight: '#6fb8f2', wing: '#dff0ff' },
  { id: 'chick', name: 'little chick', unlockAt: 21, body: '#c98a1e', bodyLight: '#ffd873', wing: '#fff1cf' },
  { id: 'owlet', name: 'baby owl', unlockAt: 26, body: '#5a4632', bodyLight: '#c9a978', wing: '#ede0cc' },
];
