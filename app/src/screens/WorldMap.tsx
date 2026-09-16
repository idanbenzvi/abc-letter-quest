import { CURRICULUM_ORDER } from '../data/curriculum';
import { ZONES } from '../data/zones';
import { getFocusLetter, isReachable } from '../engine/scheduler';
import { computeStreak } from '../engine/stats';
import { isZoneComplete, zoneProgress } from '../engine/zones';
import { useApp } from '../state/AppContext';
import { CompanionIcon, LockedCompanionIcon } from '../components/icons/CompanionIcon';
import { MysteryIcon, StarIcon, CheckIcon } from '../components/icons/Misc';
import './WorldMap.css';

const AVATAR_COLOR: Record<string, string> = {
  fox: 'var(--coral)',
  bee: 'var(--sun)',
  owl: 'var(--sky)',
  cat: 'var(--berry)',
  rabbit: 'var(--leaf)',
};

export function WorldMap({ onPlay, onOpenDashboard }: { onPlay: (letter: string) => void; onOpenDashboard: () => void }) {
  const { state } = useApp();
  const { profile, letters } = state;
  if (!profile) return null;

  const focusLetter = getFocusLetter(letters, CURRICULUM_ORDER);
  const streak = computeStreak(state.sessions);

  return (
    <div className="world-map">
      <div className="map-topbar">
        <div className="map-profile">
          <div className="map-avatar" style={{ background: AVATAR_COLOR[profile.avatar] }} />
          <span className="font-display map-name">Hi, {profile.name}!</span>
        </div>
        <div className="map-stats">
          <div className="stat-chip" style={{ background: 'var(--sun-wash)', color: 'var(--sun-dark)' }}>
            <StarIcon size={16} />
            {state.starsTotal}
          </div>
          <div className="stat-chip" style={{ background: 'var(--leaf-wash)', color: 'var(--leaf-dark)' }}>
            {streak}-day streak
          </div>
          <button type="button" className="settings-btn" onClick={onOpenDashboard} aria-label="Progress dashboard">
            <svg viewBox="0 0 24 24" width={20} height={20}>
              <circle cx="12" cy="12" r="3" fill="none" stroke="var(--ink-soft)" strokeWidth="1.8" />
              <path
                d="M12,3 L12,6 M12,18 L12,21 M3,12 L6,12 M18,12 L21,12 M5.6,5.6 L7.7,7.7 M16.3,16.3 L18.4,18.4 M5.6,18.4 L7.7,16.3 M16.3,7.7 L18.4,5.6"
                stroke="var(--ink-soft)"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="crew-row">
        <span className="crew-label">Your crew</span>
        {ZONES.map((zone) => {
          const unlocked = isZoneComplete(zone, letters);
          return (
            <div className="crew-slot" key={zone.id}>
              <div className="crew-slot-ring" style={{ background: unlocked ? zone.accentWash : 'var(--surface-2)', border: `2px solid ${unlocked ? zone.accent : 'var(--sky-wash)'}` }}>
                {unlocked ? <CompanionIcon id={zone.companion.id} size={40} /> : <LockedCompanionIcon size={40} />}
              </div>
              <span className="crew-slot-name">{unlocked ? zone.companion.name.split(' ')[0] : '???'}</span>
            </div>
          );
        })}
      </div>

      <div className="map-scroll">
        {ZONES.map((zone) => {
          const { mastered, total } = zoneProgress(zone, letters);
          const complete = mastered === total;
          return (
            <div className="zone-band" key={zone.id} style={{ background: zone.accentWash }}>
              <div className="zone-header">
                <span className="font-display zone-title" style={{ color: zone.accentDark }}>
                  {zone.name}
                </span>
                <span className="zone-progress-pill" style={{ color: zone.accentDark }}>
                  {mastered}/{total}
                </span>
                {complete && (
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <CheckIcon color={zone.accentDark} size={16} />
                  </span>
                )}
              </div>

              <div className="zone-stones">
                {zone.letters.map((letter, i) => {
                  const progress = letters[letter];
                  const box = progress?.box ?? 0;
                  const reachable = isReachable(letter, letters, CURRICULUM_ORDER);
                  const letterMastered = box >= 4;
                  const isCurrent = letter === focusLetter;
                  const size = isCurrent ? 88 : letterMastered ? 62 : 56;
                  const bg = isCurrent ? 'var(--coral)' : letterMastered ? 'var(--leaf)' : reachable ? 'var(--sun)' : 'var(--surface-2)';
                  const color = letterMastered || isCurrent || reachable ? 'white' : 'var(--ink-soft)';
                  const border = isCurrent
                    ? '4px solid var(--coral-dark)'
                    : letterMastered
                      ? '3px solid var(--leaf-dark)'
                      : reachable
                        ? '3px solid var(--sun-dark)'
                        : '3px solid var(--sky-wash)';

                  return (
                    <div className="stone-wrap" key={letter} style={{ transform: `translateY(${Math.sin(i * 0.9) * 18}px)` }}>
                      <button
                        type="button"
                        className="stone"
                        disabled={!reachable}
                        onClick={() => onPlay(letter)}
                        style={{ width: size, height: size, fontSize: isCurrent ? 34 : 22, background: bg, color, border, opacity: reachable ? 1 : 0.6 }}
                      >
                        {letter}
                        {letterMastered && (
                          <span className="stone-badge">
                            <StarIcon size={20} />
                          </span>
                        )}
                        {!reachable && (
                          <span className="stone-badge" style={{ top: 'auto', bottom: -8, right: '50%', transform: 'translateX(50%)' }}>
                            <MysteryIcon size={20} />
                          </span>
                        )}
                      </button>
                      {isCurrent && <span className="stone-play">Play!</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
