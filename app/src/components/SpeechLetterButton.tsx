import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { isSpeechRecognitionSupported, listenOnce } from '../engine/speech';
import { matchesLetterName } from '../engine/letterNameMatch';
import { MicIcon } from './icons/Misc';
import './SpeechLetterButton.css';

type Status = 'idle' | 'listening' | 'no-match' | 'trouble';

const RESET_AFTER_MS = 1600;

export interface SpeechLetterButtonHandle {
  /** Starts listening exactly as if the button itself were tapped — lets FlightGameScreen's spacebar shortcut trigger the same flow without duplicating the recognition logic. A no-op while already listening. */
  trigger: () => void;
}

/**
 * "Say the letter for a bonus" — a fifth path alongside tap, type,
 * trace, and picture-choice, reusing the same listenOnce() speech
 * infrastructure already built for BonusChallenge.tsx's "think of your
 * own word" round (see engine/speech.ts's privacy note: opt-in per tap,
 * sends audio to the browser vendor's cloud recognizer, never always-on).
 * Renders nothing at all when the browser has no SpeechRecognition
 * (Firefox, some Safari versions) — same silent-fallback shape as the
 * recorded-audio/synthesis choice in engine/audio.ts, not an error state.
 */
export const SpeechLetterButton = forwardRef<SpeechLetterButtonHandle, { targetLetter: string; onMatch: () => void; showKeyHint?: boolean }>(
  function SpeechLetterButton({ targetLetter, onMatch, showKeyHint = true }, ref) {
    const [status, setStatus] = useState<Status>('idle');
    const cancelRef = useRef<(() => void) | null>(null);
    const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);
    const statusRef = useRef(status);
    statusRef.current = status;

    useEffect(
      () => () => {
        mountedRef.current = false;
        cancelRef.current?.();
        if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
      },
      [],
    );

    async function startListening() {
      if (statusRef.current === 'listening') return;
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
      setStatus('listening');
      const { promise, cancel } = listenOnce();
      cancelRef.current = cancel;
      const result = await promise;
      cancelRef.current = null;
      if (!mountedRef.current) return;

      if ('error' in result) {
        if (result.error === 'cancelled') {
          setStatus('idle');
          return;
        }
        setStatus(result.error === 'no-speech' ? 'no-match' : 'trouble');
      } else if (matchesLetterName(result.transcript, targetLetter)) {
        setStatus('idle');
        onMatch();
        return;
      } else {
        setStatus('no-match');
      }
      resetTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) setStatus('idle');
      }, RESET_AFTER_MS);
    }

    useImperativeHandle(ref, () => ({ trigger: startListening }));

    // Rules-of-hooks requires every hook above to run on every render
    // regardless of support — only the render output itself is
    // conditional, checked after all hooks are already called.
    if (!isSpeechRecognitionSupported()) return null;

    const label =
      status === 'listening'
        ? 'Listening…'
        : status === 'no-match'
          ? "Didn't catch that"
          : status === 'trouble'
            ? "Can't hear the mic"
            : showKeyHint
              ? 'Say the letter! (Space)'
              : 'Say the letter!';

    return (
      <button
        type="button"
        className={`speech-letter-btn${status === 'listening' ? ' listening' : ''}`}
        onClick={startListening}
        aria-label="Say the letter for a bonus"
      >
        <span className="speech-letter-icon">
          <MicIcon color={status === 'listening' ? 'white' : 'var(--sky-dark, #2e7fa8)'} size={15} />
        </span>
        <span>{label}</span>
      </button>
    );
  },
);
