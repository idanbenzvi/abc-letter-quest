// Curriculum order. Phase 1 MVP: plain alphabetical.
// See docs/02-pedagogy.md#l2-aware-sequencing — this is a documented
// placeholder, not the intended final order. Reordering later is a
// one-line change to this array, nothing else depends on A-Z order.
export const CURRICULUM_ORDER: readonly string[] = Array.from(
  { length: 26 },
  (_, i) => String.fromCharCode(65 + i),
);
