import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type { AppState, PlayerState, Profile, SessionSummary, WritingPracticeMode } from '../types';
import { EMPTY_PLAYER_STATE, loadState, saveState } from '../engine/storage';
import { addSelfWord, applyAnswer, createLetterProgress, decaySessionGaps } from '../engine/scheduler';
import { CURRICULUM_ORDER } from '../data/curriculum';

type Action =
  | { type: 'ADD_PLAYER'; profile: Profile }
  | { type: 'SWITCH_PLAYER'; id: string }
  | { type: 'START_SESSION' }
  | { type: 'ANSWER'; letter: string; correct: boolean }
  | { type: 'LOG_SESSION'; summary: SessionSummary }
  | { type: 'RECORD_SELF_WORD'; letter: string; word: string }
  | { type: 'SET_LAST_WORD'; letter: string; wordId: string }
  | { type: 'ADD_STARS'; count: number }
  | { type: 'SET_MISSION_DURATION'; seconds: number }
  | { type: 'SET_SOUND_ENABLED'; enabled: boolean }
  | { type: 'SET_WRITING_PRACTICE'; mode: WritingPracticeMode }
  | { type: 'RESET_PROGRESS' };

function newPlayerId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Applies a per-player update to whichever player is currently active — every gameplay action (answering, logging a session, stars...) is scoped to one child's own data, never the whole players map. */
function updateActivePlayer(state: AppState, update: (player: PlayerState) => PlayerState): AppState {
  const id = state.activePlayerId;
  if (!id) return state;
  const current = state.players[id];
  if (!current) return state;
  return { ...state, players: { ...state.players, [id]: update(current) } };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_PLAYER': {
      const letters = Object.fromEntries(CURRICULUM_ORDER.map((l) => [l, createLetterProgress(l)]));
      const id = newPlayerId();
      const player: PlayerState = { ...EMPTY_PLAYER_STATE, profile: action.profile, letters };
      return { players: { ...state.players, [id]: player }, activePlayerId: id };
    }
    case 'SWITCH_PLAYER': {
      if (!state.players[action.id]) return state;
      return { ...state, activePlayerId: action.id };
    }
    case 'START_SESSION': {
      return updateActivePlayer(state, (p) => ({ ...p, letters: decaySessionGaps(p.letters) }));
    }
    case 'ANSWER': {
      return updateActivePlayer(state, (p) => {
        const current = p.letters[action.letter];
        if (!current) return p;
        const updated = applyAnswer(current, action.correct);
        return {
          ...p,
          letters: { ...p.letters, [action.letter]: updated },
          starsTotal: p.starsTotal + (action.correct ? 1 : 0),
        };
      });
    }
    case 'RECORD_SELF_WORD': {
      return updateActivePlayer(state, (p) => {
        const current = p.letters[action.letter];
        if (!current) return p;
        // A self-generated word is a bonus, rewarded with a star, but
        // never touches the scheduler box — see BonusChallenge.tsx.
        return {
          ...p,
          letters: { ...p.letters, [action.letter]: addSelfWord(current, action.word) },
          starsTotal: p.starsTotal + 1,
        };
      });
    }
    case 'ADD_STARS': {
      return updateActivePlayer(state, (p) => ({ ...p, starsTotal: p.starsTotal + action.count }));
    }
    case 'SET_MISSION_DURATION': {
      return updateActivePlayer(state, (p) => ({ ...p, settings: { ...p.settings, missionDurationSeconds: action.seconds } }));
    }
    case 'SET_SOUND_ENABLED': {
      return updateActivePlayer(state, (p) => ({ ...p, settings: { ...p.settings, soundEnabled: action.enabled } }));
    }
    case 'SET_WRITING_PRACTICE': {
      return updateActivePlayer(state, (p) => ({ ...p, settings: { ...p.settings, writingPractice: action.mode } }));
    }
    case 'RESET_PROGRESS': {
      // Wipes learning progress (letter mastery, stars, session history)
      // back to a fresh start, but keeps the child's profile and
      // settings — this is "start training over", not "delete the
      // child" or "forget how long they like to fly".
      return updateActivePlayer(state, (p) => {
        if (!p.profile) return p;
        const letters = Object.fromEntries(CURRICULUM_ORDER.map((l) => [l, createLetterProgress(l)]));
        return { ...p, letters, sessions: [], starsTotal: 0 };
      });
    }
    case 'SET_LAST_WORD': {
      return updateActivePlayer(state, (p) => {
        const current = p.letters[action.letter];
        if (!current) return p;
        return { ...p, letters: { ...p.letters, [action.letter]: { ...current, lastWordId: action.wordId } } };
      });
    }
    case 'LOG_SESSION': {
      return updateActivePlayer(state, (p) => {
        // Keep a bounded history — the dashboard only ever needs the last
        // few weeks, no reason to grow this file forever.
        const sessions = [...p.sessions, action.summary].slice(-200);
        return { ...p, sessions };
      });
    }
    default:
      return state;
  }
}

export interface PlayerSummary {
  id: string;
  profile: Profile;
}

interface AppContextValue {
  /** The currently active player's own data — every existing screen reads this exactly as before multi-player support existed. */
  state: PlayerState;
  /** Every player on this device, for the player-select screen. */
  players: PlayerSummary[];
  activePlayerId: string | null;
  createProfile: (profile: Profile) => void;
  switchPlayer: (id: string) => void;
  startSession: () => void;
  answer: (letter: string, correct: boolean) => void;
  logSession: (summary: SessionSummary) => void;
  recordSelfWord: (letter: string, word: string) => void;
  setLastWord: (letter: string, wordId: string) => void;
  awardStars: (count: number) => void;
  setMissionDuration: (seconds: number) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setWritingPractice: (mode: WritingPracticeMode) => void;
  resetProgress: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [rootState, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    saveState(rootState);
  }, [rootState]);

  const activePlayer = rootState.activePlayerId ? rootState.players[rootState.activePlayerId] : null;
  const players: PlayerSummary[] = Object.entries(rootState.players)
    .filter((entry): entry is [string, PlayerState & { profile: Profile }] => entry[1].profile !== null)
    .map(([id, p]) => ({ id, profile: p.profile }));

  const value: AppContextValue = {
    state: activePlayer ?? EMPTY_PLAYER_STATE,
    players,
    activePlayerId: rootState.activePlayerId,
    createProfile: (profile) => dispatch({ type: 'ADD_PLAYER', profile }),
    switchPlayer: (id) => dispatch({ type: 'SWITCH_PLAYER', id }),
    startSession: () => dispatch({ type: 'START_SESSION' }),
    answer: (letter, correct) => dispatch({ type: 'ANSWER', letter, correct }),
    logSession: (summary) => dispatch({ type: 'LOG_SESSION', summary }),
    recordSelfWord: (letter, word) => dispatch({ type: 'RECORD_SELF_WORD', letter, word }),
    setLastWord: (letter, wordId) => dispatch({ type: 'SET_LAST_WORD', letter, wordId }),
    awardStars: (count) => dispatch({ type: 'ADD_STARS', count }),
    setMissionDuration: (seconds) => dispatch({ type: 'SET_MISSION_DURATION', seconds }),
    setSoundEnabled: (enabled) => dispatch({ type: 'SET_SOUND_ENABLED', enabled }),
    setWritingPractice: (mode) => dispatch({ type: 'SET_WRITING_PRACTICE', mode }),
    resetProgress: () => dispatch({ type: 'RESET_PROGRESS' }),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
