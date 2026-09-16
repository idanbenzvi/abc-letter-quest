import { Wordmark } from '../components/Brand';
/**
 * "Spreading wings…" overlay shown while the 3D chunk and/or the bird
 * mesh are still loading. Deliberately has no three.js imports: it's
 * used both by FlightGameScreen (as the lazy chunk's Suspense fallback,
 * with no progress to report) and inside FlightCanvas (with drei's real
 * loading progress), and a static import of anything in the 3D module
 * would pull that whole stack back into the first chunk.
 */
export function FlightLoadingVeil({ progress }: { progress?: number }) {
  return (
    <div className="flight-loading" role="status" aria-live="polite">
      <Wordmark width={260} className="flight-loading-brand" />
      <div className="flight-loading-wings" aria-hidden="true">
        <svg viewBox="0 0 120 40" width="120" height="40">
          <path d="M4 30 C24 6 44 8 58 26 C60 29 60 29 62 26 C76 8 96 6 116 30 C96 22 78 26 62 36 C60 37 60 37 58 36 C42 26 24 22 4 30 Z" fill="white" />
        </svg>
      </div>
      <span className="flight-loading-text">Spreading wings…</span>
      <span className="flight-loading-bar" aria-hidden="true">
        <span style={{ width: `${Math.max(8, progress ?? 8)}%` }} className={progress === undefined ? 'indeterminate' : undefined} />
      </span>
    </div>
  );
}
