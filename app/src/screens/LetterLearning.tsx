import { useEffect, useMemo, useRef, useState } from 'react';
import type { LetterProgress } from '../types';
import { useApp } from '../state/AppContext';
import { buildQueue, decaySessionGaps } from '../engine/scheduler';
import { buildQuizOptions } from '../engine/quiz';
import { speak } from '../engine/audio';
import { isSpeechRecognitionSupported } from '../engine/speech';
import { pickWordForLetter } from '../engine/wordBank';
import { isZoneComplete } from '../engine/zones';
import { ZONE_BY_LETTER } from '../data/zones';
import { WORDS } from '../data/words';
import { WordIcon } from '../components/icons/WordIcons';
import { SpeakerIcon, CheckIcon } from '../components/icons/Misc';
import { BonusChallenge } from './BonusChallenge';
import { StrokeAnimation } from '../components/StrokeAnimation';
import { TraceCanvas } from '../components/TraceCanvas';
import './LetterLearning.css';

const TRACE_BONUS_STAR_THRESHOLD = 60;

// The reveal beat's sequence, per item — see
// docs/04-screens-spec.md#3-letter-learning: show the letter, watch it
// get written uppercase then lowercase, then the word appears on its
// own (no click needed for that last step).
type RevealStage = 'letter' | 'writing-upper' | 'writing-lower' | 'word';

const STAGE_LETTER_DELAY_MS = 1300;

export interface LetterLearningResult {
  masteredLetters: string[];
  completedZones: string[];
}

interface LetterLearningProps {
  letter: string;
  onFinish: (result: LetterLearningResult) => void;
}

export function LetterLearning({ letter, onFinish }: LetterLearningProps) {
  const { state, answer, logSession, startSession, recordSelfWord, setLastWord, awardStars } = useApp();
  const bonusAvailable = useMemo(() => isSpeechRecognitionSupported(), []);

  // Compute the session queue once, from a locally-decayed snapshot so
  // it's available synchronously on first render; startSession()
  // persists that same decay to the shared store separately.
  const initRef = useRef<{ queue: string[] } | null>(null);
  if (!initRef.current) {
    initRef.current = { queue: buildQueue(letter, decaySessionGaps(state.letters)) };
  }
  const queue = initRef.current.queue;

  useEffect(() => {
    startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<RevealStage>('letter');
  const [traceDone, setTraceDone] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [bonusDone, setBonusDone] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const masteredRef = useRef<string[]>([]);
  const zonesCompletedRef = useRef<string[]>([]);
  const practicedRef = useRef<Set<string>>(new Set());
  const sessionStartedAt = useRef(new Date().toISOString());

  const currentLetter = queue[index];
  // Picks a word for this letter, avoiding whichever one it showed last
  // time (engine/wordBank.ts) — this is the practice-variety mechanic.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const word = useMemo(() => pickWordForLetter(currentLetter, state.letters[currentLetter]?.lastWordId ?? null), [currentLetter]);
  useEffect(() => {
    setLastWord(currentLetter, word.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.id]);
  // Deliberately keyed on `word` alone: distractor options should be
  // picked once per quiz item, not reshuffled if unrelated state changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const options = useMemo(() => buildQuizOptions(word, WORDS, state.letters), [word]);

  // Auto-advance out of the static-letter beat into the writing
  // animation after a short pause — no tap required. The writing
  // stages themselves advance via StrokeAnimation's onComplete below.
  useEffect(() => {
    if (stage !== 'letter') return;
    const t = setTimeout(() => setStage('writing-upper'), STAGE_LETTER_DELAY_MS);
    return () => clearTimeout(t);
  }, [stage]);

  function handleListenSound() {
    speak(currentLetter);
  }

  function handleListenWord() {
    speak(word.word);
  }

  function handleSelect(choiceId: string) {
    if (selected) return;
    setSelected(choiceId);
    const correct = choiceId === word.id;
    practicedRef.current.add(currentLetter);
    if (correct) setCorrectCount((c) => c + 1);

    const prevBox = state.letters[currentLetter]?.box ?? 0;
    const newBox = correct ? Math.min(4, prevBox + 1) : Math.max(0, prevBox - 1);
    if (newBox === 4 && prevBox !== 4) {
      masteredRef.current.push(currentLetter);
      // Check whether this was the LAST letter its zone needed — every
      // other letter in the zone already reflects its true box in
      // state.letters, only currentLetter's is stale here.
      const zone = ZONE_BY_LETTER[currentLetter];
      if (zone) {
        const projected = {
          ...state.letters,
          [currentLetter]: { ...state.letters[currentLetter], box: newBox as LetterProgress['box'] },
        };
        if (isZoneComplete(zone, projected)) zonesCompletedRef.current.push(zone.id);
      }
    }

    answer(currentLetter, correct);
  }

  function handleNext() {
    if (index + 1 < queue.length) {
      setIndex((i) => i + 1);
      setStage('letter');
      setTraceDone(false);
      setQuizStarted(false);
      setSelected(null);
      setBonusDone(false);
      return;
    }
    const now = new Date();
    logSession({
      date: now.toISOString().slice(0, 10),
      startedAt: sessionStartedAt.current,
      endedAt: now.toISOString(),
      lettersPracticed: Array.from(practicedRef.current),
      correctCount,
      totalCount: queue.length,
    });
    onFinish({ masteredLetters: masteredRef.current, completedZones: zonesCompletedRef.current });
  }

  function handleExit() {
    onFinish({ masteredLetters: [], completedZones: [] });
  }

  function handleBonusDone(matchedWord: string | null) {
    if (matchedWord) recordSelfWord(currentLetter, matchedWord);
    setBonusDone(true);
  }

  // The bonus "think of your own word" round only runs once per
  // session, for the letter the child actually chose to play — not for
  // every review item in the queue. See docs/04-screens-spec.md#bonus-challenge-think-of-your-own-word.
  const showBonusStep = index === 0 && bonusAvailable;
  // Same scoping for the trace challenge — the point is real practice on
  // the letter being actively learned, not re-tracing already-mastered
  // review letters every single rep. See docs/04-screens-spec.md#trace-challenge-your-turn.
  const showTraceStep = index === 0;

  function handleTraceComplete(score: number) {
    if (score >= TRACE_BONUS_STAR_THRESHOLD) awardStars(1);
    setTraceDone(true);
  }

  return (
    <div className="learn">
      <div className="learn-topbar">
        <button type="button" className="icon-btn" onClick={handleExit} aria-label="Back">
          <svg viewBox="0 0 24 24" width={18} height={18}>
            <path d="M15,5 L8,12 L15,19" stroke="var(--ink-soft)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="progress-dots">
          {queue.map((_, i) => (
            <div key={i} className={`progress-dot${i <= index ? ' filled' : ''}`} />
          ))}
        </div>
        <div style={{ width: 42 }} />
      </div>

      <div className="learn-columns">
        <div className="reveal-col">
          <div className="speech-bubble">
            {stage === 'letter' && 'Listen close — you already know this sound!'}
            {stage === 'writing-upper' && `Watch — here's how to write a big ${currentLetter}!`}
            {stage === 'writing-lower' && `Now the little ${currentLetter.toLowerCase()} — almost the same!`}
            {stage === 'word' && 'You found it!'}
          </div>

          <div className="letter-circle">
            {stage === 'writing-upper' && (
              <StrokeAnimation key={`up-${currentLetter}`} letter={currentLetter} isUpper onComplete={() => setStage('writing-lower')} />
            )}
            {stage === 'writing-lower' && (
              <StrokeAnimation key={`low-${currentLetter}`} letter={currentLetter} isUpper={false} onComplete={() => setStage('word')} />
            )}
            {(stage === 'letter' || stage === 'word') && (
              <span className="letter-solid-static">
                {currentLetter}
                {currentLetter.toLowerCase()}
              </span>
            )}
          </div>

          {stage === 'writing-upper' || stage === 'writing-lower' ? (
            <button type="button" className="skip-link" onClick={() => setStage('word')}>
              Skip ahead
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={handleListenSound} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SpeakerIcon color="var(--sky-dark)" /> {stage === 'letter' ? 'Tap to hear the sound' : 'Hear it again'}
            </button>
          )}
        </div>

        {stage === 'word' && (
          <div className="card word-col">
            <WordIcon id={word.id} size={100} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }} className="font-display">
              <span style={{ fontSize: 40, fontWeight: 700, color: 'var(--coral-dark)' }}>{word.word[0]}</span>
              <span style={{ fontSize: 40, fontWeight: 700 }}>{word.word.slice(1)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="phoneme-badge">{word.phoneme}</span>
              <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>the sound you just found — it starts "{word.word}" too!</span>
            </div>
            <button
              type="button"
              className="btn"
              style={{ background: 'var(--coral-wash)', color: 'var(--coral-dark)', display: 'flex', alignItems: 'center', gap: 8 }}
              onClick={handleListenWord}
            >
              <SpeakerIcon color="var(--coral-dark)" /> Tap to hear "{word.word}"
            </button>

            {showTraceStep && !traceDone ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <p className="font-display" style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                  Your turn! Trace the {currentLetter}
                </p>
                <TraceCanvas letter={currentLetter} onComplete={handleTraceComplete} />
              </div>
            ) : (
              !quizStarted && (
                <button type="button" className="btn btn-primary font-display" onClick={() => setQuizStarted(true)}>
                  Find the match!
                </button>
              )
            )}
          </div>
        )}
      </div>

      {quizStarted && (
        <div className="quiz-section">
          <p className="quiz-prompt font-display">Which picture starts with the {word.phoneme} sound?</p>
          <div className="quiz-grid">
            {options.map((opt) => {
              const isSelected = selected === opt.id;
              const isCorrectOpt = opt.id === word.id;
              const state_ = selected ? (isCorrectOpt ? 'correct' : isSelected ? 'incorrect' : '') : '';
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`quiz-option ${state_}`}
                  disabled={!!selected}
                  onClick={() => handleSelect(opt.id)}
                >
                  {selected && isCorrectOpt && (
                    <span className="quiz-badge">
                      <CheckIcon size={14} />
                    </span>
                  )}
                  <WordIcon id={opt.id} size={64} />
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{opt.word}</span>
                </button>
              );
            })}
          </div>
          {selected && showBonusStep && !bonusDone && <BonusChallenge letter={currentLetter} onDone={handleBonusDone} />}

          {selected && (!showBonusStep || bonusDone) && (
            <div className="next-row">
              <button type="button" className="btn btn-primary font-display" onClick={handleNext}>
                {index + 1 < queue.length ? 'Next' : 'Finish'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
