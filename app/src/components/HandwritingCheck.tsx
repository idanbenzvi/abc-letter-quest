import { useEffect, useRef, useState } from 'react';
import { checkHandwriting } from '../engine/handwritingMatch';
import { CameraIcon, CloseIcon, CheckIcon } from './icons/Misc';
import './HandwritingCheck.css';

type Status = 'starting' | 'live' | 'checking' | 'matched' | 'no-match' | 'denied' | 'no-camera' | 'error';

// The on-screen guide is expressed as fractions of the preview's own
// box, not pixels — the preview's CSS aspect-ratio is set to match the
// live video's REAL native aspect ratio the moment metadata loads (see
// handleLoadedMetadata), so these same fractions map exactly onto the
// captured frame's actual pixel dimensions at check time with no
// separate coordinate conversion needed.
const STAR_TARGET = { xFrac: 0.15, yFrac: 0.5 };
const GUIDE_BOX = { xFrac: 0.32, yFrac: 0.16, wFrac: 0.52, hFrac: 0.68 };

export function HandwritingCheck({ letter, onMatch, onClose }: { letter: string; onMatch: () => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [aspectRatio, setAspectRatio] = useState(4 / 3);
  const mountedRef = useRef(true);
  // Bumped on every startCamera() call (mount, and each "Try again"),
  // and captured per-call — a resolved getUserMedia checks it's still
  // the CURRENT attempt before touching state/refs, not just that the
  // component is still mounted. Needed because `mountedRef` alone isn't
  // enough: React 19's StrictMode (dev only) double-invokes this effect
  // (mount -> cleanup -> mount), and the FIRST call's getUserMedia can
  // resolve after the SECOND mount has already flipped mountedRef back
  // to true — so the stale first call passes the mountedRef check, opens
  // its own camera stream, and then the second call's stream overwrites
  // it in streamRef, orphaning the first (still-running) stream and
  // occasionally surfacing as a spurious 'error' status. Confirmed real:
  // reproduced in dev (`npm run dev`), absent from a production build
  // (no double-invoke there) — this generation check is what makes dev
  // behave the same as production instead of the feature looking broken
  // to anyone testing it locally.
  const requestIdRef = useRef(0);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    const requestId = ++requestIdRef.current;
    setStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // A hint, not a guarantee — browsers fall back gracefully on a
        // single-camera laptop. "environment" (the rear/outward camera
        // on a phone) is the natural choice for pointing at a piece of
        // paper on a desk, rather than the front/selfie camera.
        video: { facingMode: 'environment' },
        audio: false,
      });
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (mountedRef.current && requestId === requestIdRef.current) setStatus('live');
      pollVideoDimensions(requestId);
    } catch (e) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      const name = e instanceof DOMException ? e.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') setStatus('denied');
      else if (name === 'NotFoundError' || name === 'OverconstrainedError') setStatus('no-camera');
      else setStatus('error');
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    void startCamera();
    return () => {
      mountedRef.current = false;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyRealDimensions(v: HTMLVideoElement) {
    if (v.videoWidth && v.videoHeight) setAspectRatio(v.videoWidth / v.videoHeight);
  }

  function handleLoadedMetadata() {
    if (videoRef.current) applyRealDimensions(videoRef.current);
  }

  // Belt-and-suspenders for `loadedmetadata`: at least one class of iOS
  // Safari bug fires it for a camera MediaStream before videoWidth/
  // videoHeight are actually populated, which would otherwise leave
  // `aspectRatio` stuck at the 4:3 fallback for the whole session. That
  // matters here specifically because the on-screen guide box's screen
  // position is only trustworthy — i.e. actually lines up with the
  // region handleCheck crops out of the real frame — once the preview's
  // CSS aspect-ratio truly matches the camera's native one; until then,
  // `object-fit: cover` silently crops the DISPLAYED feed differently
  // than the raw frame gets cropped for scoring, so what the child
  // writes in the visible box and what actually gets scored can be two
  // different patches of the photo. Bounded so a stream that genuinely
  // never reports dimensions doesn't poll forever.
  function pollVideoDimensions(requestId: number, attempt = 0) {
    if (!mountedRef.current || requestId !== requestIdRef.current) return;
    const v = videoRef.current;
    if (v && v.videoWidth && v.videoHeight) {
      applyRealDimensions(v);
      return;
    }
    if (attempt >= 40) return; // ~2s at 50ms — well past any real device's startup time
    setTimeout(() => pollVideoDimensions(requestId, attempt + 1), 50);
  }

  async function handleCheck() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setStatus('checking');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setStatus('error');
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const crop = {
      x: Math.round(GUIDE_BOX.xFrac * canvas.width),
      y: Math.round(GUIDE_BOX.yFrac * canvas.height),
      w: Math.round(GUIDE_BOX.wFrac * canvas.width),
      h: Math.round(GUIDE_BOX.hFrac * canvas.height),
    };
    const result = await checkHandwriting(letter, ctx, crop);
    if (!mountedRef.current) return;
    setStatus(result.matched ? 'matched' : 'no-match');
    if (result.matched) {
      stopStream();
      setTimeout(() => {
        if (mountedRef.current) onMatch();
      }, 900); // a beat to see the "Got it!" state before the overlay closes
    }
  }

  function handleClose() {
    stopStream();
    onClose();
  }

  return (
    <div className="handwriting-overlay" role="dialog" aria-modal="true" aria-label="Write it on paper">
      <div className="handwriting-card">
        <button type="button" className="handwriting-close" onClick={handleClose} aria-label="Close">
          <CloseIcon size={16} color="var(--ink-soft, #7a6b5a)" />
        </button>

        {(status === 'starting' || status === 'live' || status === 'checking') && (
          <>
            <p className="handwriting-instructions">
              Draw a <strong>✳</strong> where the circle is, then write a big <strong>{letter}</strong> in the box — hold your paper
              still and tap <strong>Check it!</strong>
            </p>
            <div className="handwriting-preview" style={{ aspectRatio }}>
              <video ref={videoRef} className="handwriting-video" playsInline muted onLoadedMetadata={handleLoadedMetadata} />
              <div className="handwriting-guide" aria-hidden="true">
                <div className="handwriting-star-target" style={{ left: `${STAR_TARGET.xFrac * 100}%`, top: `${STAR_TARGET.yFrac * 100}%` }}>
                  ✳
                </div>
                <div
                  className="handwriting-guide-box"
                  style={{
                    left: `${GUIDE_BOX.xFrac * 100}%`,
                    top: `${GUIDE_BOX.yFrac * 100}%`,
                    width: `${GUIDE_BOX.wFrac * 100}%`,
                    height: `${GUIDE_BOX.hFrac * 100}%`,
                  }}
                />
              </div>
              {status !== 'live' && (
                <div className="handwriting-preview-veil">{status === 'checking' ? 'Looking…' : 'Starting camera…'}</div>
              )}
            </div>
            <button type="button" className="btn btn-primary font-display handwriting-check-btn" onClick={handleCheck} disabled={status !== 'live'}>
              <CameraIcon size={18} color="white" /> Check it!
            </button>
          </>
        )}

        {status === 'matched' && (
          <div className="handwriting-result matched">
            <CheckIcon size={40} color="var(--leaf-dark, #3a7d4f)" />
            <p>That's a {letter}! Nicely written.</p>
          </div>
        )}

        {status === 'no-match' && (
          <div className="handwriting-result">
            <p>Couldn't quite see it that time — want to try again?</p>
            <div className="handwriting-result-actions">
              <button type="button" className="btn btn-primary font-display" onClick={() => setStatus('live')}>
                Try again
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Never mind
              </button>
            </div>
          </div>
        )}

        {status === 'denied' && (
          <div className="handwriting-result">
            <p>The camera needs permission to see your paper — check your browser's site settings, then try again.</p>
            <div className="handwriting-result-actions">
              <button type="button" className="btn btn-primary font-display" onClick={() => void startCamera()}>
                Try again
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Close
              </button>
            </div>
          </div>
        )}

        {status === 'no-camera' && (
          <div className="handwriting-result">
            <p>No camera found on this device.</p>
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              Close
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="handwriting-result">
            <p>Something went wrong reaching the camera.</p>
            <div className="handwriting-result-actions">
              <button type="button" className="btn btn-primary font-display" onClick={() => void startCamera()}>
                Try again
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
