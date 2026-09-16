/**
 * "Is a trace happening right now" — a tiny shared flag between
 * three/LetterTracer.tsx (which sets it) and FlightGameScreen.tsx (which
 * reads it to suppress the hover case-swap: with a mouse, two seconds of
 * hovering over the cloud flips its case, and a child mid-trace hovers
 * by definition — the swap would rebuild the glyph and wipe their
 * half-drawn ribbon out from under them).
 *
 * Lives in its own three.js-free module on purpose: FlightGameScreen is
 * in the first-load chunk, and importing anything from the tracer would
 * pull the whole 3D stack back into it (it did, once — caught by the
 * build's chunk report).
 */
export const traceActivity = { dragging: false, lastDrawAt: 0 };

export function isTraceInProgress(): boolean {
  return traceActivity.dragging || performance.now() - traceActivity.lastDrawAt < 3000;
}
