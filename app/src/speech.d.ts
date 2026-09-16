// Ambient types for the Web Speech API's SpeechRecognition interface.
// lib.dom.d.ts (TS 5.8) ships SpeechRecognitionResult/ResultList/Alternative
// but not the recognizer itself or the vendor-prefixed constructor, so
// those are declared here. See docs/07-architecture.md#speech-to-text-bonus-word-challenge.

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => unknown) | null;
  onend: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

// eslint-disable-next-line no-var -- ambient constructor declaration, matches lib.dom.d.ts's own style
declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

interface Window {
  SpeechRecognition?: typeof SpeechRecognition;
  webkitSpeechRecognition?: typeof SpeechRecognition;
}
