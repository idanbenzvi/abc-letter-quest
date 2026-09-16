import type { AppState, PlayerState } from '../types';

const STORAGE_KEY = 'abc-letter-quest:v1';

export const EMPTY_PLAYER_STATE: PlayerState = {
  profile: null,
  letters: {},
  sessions: [],
  starsTotal: 0,
  settings: { missionDurationSeconds: 240, soundEnabled: true, writingPractice: 'first-assisted' },
};

export const EMPTY_STATE: AppState = {
  players: {},
  activePlayerId: null,
};

/** A pre-multi-player save has these at the top level instead of a `players` map — see the migration in loadState. */
interface LegacySingleProfileState {
  profile: PlayerState['profile'];
  letters?: PlayerState['letters'];
  sessions?: PlayerState['sessions'];
  starsTotal?: number;
  settings?: PlayerState['settings'];
}

function isLegacyShape(raw: unknown): raw is LegacySingleProfileState {
  return !!raw && typeof raw === 'object' && 'profile' in raw && !('players' in raw);
}

/**
 * Every save before multi-player support was one flat { profile, letters,
 * sessions, starsTotal, settings } blob for a single child. Wrap that
 * directly as this device's first player rather than discarding it — a
 * family upgrading the app should never see their kid's progress reset.
 */
function migrateLegacyState(legacy: LegacySingleProfileState): AppState {
  const id = 'legacy-player';
  const player: PlayerState = {
    profile: legacy.profile,
    letters: legacy.letters ?? {},
    sessions: legacy.sessions ?? [],
    starsTotal: legacy.starsTotal ?? 0,
    settings: { ...EMPTY_PLAYER_STATE.settings, ...(legacy.settings ?? {}) },
  };
  return { players: { [id]: player }, activePlayerId: legacy.profile ? id : null };
}

/**
 * Settings gain new keys over time (e.g. `soundEnabled` arrived after
 * the first saves existed). Fill any missing key from the defaults so
 * every screen can read `settings.x` without a per-field fallback.
 */
function withSettingsDefaults(state: AppState): AppState {
  const players: AppState['players'] = {};
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = { ...p, settings: { ...EMPTY_PLAYER_STATE.settings, ...(p.settings ?? {}) } };
  }
  return { ...state, players };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed: unknown = JSON.parse(raw);
    if (isLegacyShape(parsed)) return withSettingsDefaults(migrateLegacyState(parsed));
    return withSettingsDefaults({ ...EMPTY_STATE, ...(parsed as Partial<AppState>) });
  } catch {
    return EMPTY_STATE;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can fail (private browsing, quota). Losing persistence
    // silently is preferable to crashing the game mid-session.
  }
}
