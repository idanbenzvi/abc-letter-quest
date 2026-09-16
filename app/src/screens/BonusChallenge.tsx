import { useRef, useState } from 'react';
import { listenOnce } from '../engine/speech';
import { matchesLetter, titleCaseWord } from '../engine/wordMatch';
import { MicIcon } from '../components/icons/Misc';
import './BonusChallenge.css';

type Status = 'idle' | 'listening' | 'matched' | 'no-match' | 'trouble';

/**
 * "Think of your own word" — the generative bonus round.
 * Intentionally decoupled from the scheduler (docs/04-screens-spec.md#bonus-challenge-think-of-your-own-word):
 * speech recognition can mishear a correct answer, so this never counts
 * against a letter's mastery box, only ever adds a small bonus star and
 * a self-words log entry on a match.
 */
export function BonusChallenge({ letter, onDone }: { letter: string; onDone: (matchedWord: string | null) => void }) {
  const [status, setStatus] = useState<Status>('idle');
  const [transcript, setTranscript] = useState('');
  const cancelRef = useRef<(() => void) | null>(null);

  async function handleRecord() {
    setStatus('listening');
    const { promise, cancel } = listenOnce();
    cancelRef.current = cancel;
    const result = await promise;
    cancelRef.current = null;
    if ('error' in result) {
      if (result.error === 'cancelled') {
        onDone(null);
        return;
      }
      setStatus(result.error === 'no-speech' ? 'no-match' : 'trouble');
      setTranscript('');
      return;
    }
    setTranscript(result.transcript);
    setStatus(matchesLetter(result.transcript, letter) ? 'matched' : 'no-match');
  }

  // A child must always have a way out — including mid-listen, in case
  // the recognizer stalls on a flaky connection or an ignored
  // permission prompt (listenOnce still times out on its own after 8s,
  // this is just the faster, child-driven exit).
  function handleCancelListening() {
    cancelRef.current?.();
  }

  return (
    <div className="card bonus">
      <p className="bonus-prompt font-display">
        Can YOU think of a word that starts with {letter}? Tap the mic and say it!
      </p>

      {status === 'idle' && (
        <button type="button" className="mic-btn" onClick={handleRecord} aria-label="Record your word">
          <MicIcon />
        </button>
      )}

      {status === 'listening' && (
        <>
          <button type="button" className="mic-btn listening" disabled aria-label="Listening">
            <MicIcon />
          </button>
          <span className="bonus-result no-match">Listening...</span>
          <button type="button" className="bonus-skip" onClick={handleCancelListening}>
            Never mind
          </button>
        </>
      )}

      {status === 'matched' && (
        <>
          <span className="bonus-result match">
            "{titleCaseWord(transcript)}" starts with {letter}! Buddy loves that one!
          </span>
          <button type="button" className="btn btn-primary font-display" onClick={() => onDone(titleCaseWord(transcript))}>
            Yay!
          </button>
        </>
      )}

      {status === 'no-match' && (
        <>
          <span className="bonus-result no-match">
            {transcript ? `I heard "${titleCaseWord(transcript)}" — want to try another word?` : "I didn't quite catch that — want to try again?"}
          </span>
          <div className="bonus-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setStatus('idle')}>
              Try again
            </button>
            <button type="button" className="bonus-skip" onClick={() => onDone(null)}>
              Skip
            </button>
          </div>
        </>
      )}

      {status === 'trouble' && (
        <>
          <span className="bonus-result no-match">Buddy couldn't hear the microphone — that's okay!</span>
          <button type="button" className="btn btn-secondary" onClick={() => onDone(null)}>
            Continue
          </button>
        </>
      )}

      {status === 'idle' && (
        <button type="button" className="bonus-skip" onClick={() => onDone(null)}>
          Skip for now
        </button>
      )}
    </div>
  );
}
