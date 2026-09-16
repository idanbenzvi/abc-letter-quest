// Speech-to-text for the "think of your own word" bonus challenge.
// Uses the browser's built-in SpeechRecognition — see the privacy note
// in docs/07-architecture.md#speech-to-text-bonus-word-challenge: unlike
// the rest of this app, this sends audio to the browser vendor's cloud
// recognition service. It's opt-in (child taps a mic button) and only
// ever used for this one optional round.

function getRecognitionCtor(): typeof SpeechRecognition | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

export function isSpeechRecognitionSupported(): boolean {
  return !!getRecognitionCtor();
}

export type ListenResult = { transcript: string } | { error: string };

const LISTEN_TIMEOUT_MS = 8000;

/**
 * Records one short utterance and resolves with the best transcript.
 * Always settles within LISTEN_TIMEOUT_MS even if the browser's
 * recognizer never fires an event (seen for real on a stalled network
 * or an ignored permission prompt) — a child must never be stuck on a
 * silent "Listening..." with no way forward. Callers additionally get
 * a `cancel()` handle so the UI itself can offer a way out sooner.
 */
export function listenOnce(lang = 'en-US'): { promise: Promise<ListenResult>; cancel: () => void } {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    return { promise: Promise.resolve({ error: 'unsupported' }), cancel: () => {} };
  }

  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let settled = false;
  let resolveFn: (result: ListenResult) => void;
  const promise = new Promise<ListenResult>((resolve) => {
    resolveFn = resolve;
  });

  const finish = (result: ListenResult) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    resolveFn(result);
  };

  const timer = setTimeout(() => {
    finish({ error: 'timeout' });
    try {
      recognition.abort();
    } catch {
      // already stopped — nothing to clean up
    }
  }, LISTEN_TIMEOUT_MS);

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.item(0)?.transcript ?? '';
    finish({ transcript });
  };
  recognition.onerror = (event) => {
    finish({ error: event.error || 'unknown' });
  };
  recognition.onend = () => {
    finish({ error: 'no-speech' });
  };

  try {
    recognition.start();
  } catch {
    finish({ error: 'start-failed' });
  }

  const cancel = () => {
    finish({ error: 'cancelled' });
    try {
      recognition.abort();
    } catch {
      // already stopped — nothing to clean up
    }
  };

  return { promise, cancel };
}
