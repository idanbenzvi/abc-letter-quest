import { useState } from 'react';
import { useApp } from '../state/AppContext';
import { AvatarIcon } from '../components/icons/AvatarIcon';
import { Wordmark } from '../components/Brand';
import { CheckIcon, ChevronLeftIcon } from '../components/icons/Misc';
import { Onboarding } from './Onboarding';
import * as sfx from '../engine/sfx';
import './PlayerSelect.css';

/**
 * "Who's flying today?" — shown whenever there's no active player (first
 * launch with 1+ existing players, or after switching from the settings
 * menu mid-play) but at least one player already exists; App.tsx skips
 * straight to Onboarding instead when there are none yet at all, so a
 * new install still feels like today's single-child flow, not a picker
 * with nothing in it.
 */
export function PlayerSelect({ onSelected, onCancel }: { onSelected: () => void; onCancel?: () => void }) {
  const { players, activePlayerId, switchPlayer } = useApp();
  const [adding, setAdding] = useState(false);

  if (adding) {
    return <Onboarding onCreated={onSelected} onCancel={() => setAdding(false)} />;
  }

  function handlePick(id: string) {
    sfx.unlock();
    sfx.play('correct');
    switchPlayer(id);
    onSelected();
  }

  return (
    <div className="player-select">
      {onCancel && (
        <button type="button" className="back-link onboarding-back" onClick={onCancel}>
          <ChevronLeftIcon size={18} /> Back
        </button>
      )}
      <div className="player-select-header stagger">
        <div className="onboarding-hero">
          <Wordmark width={300} />
        </div>
        <h1 className="font-display player-select-title">Who's Flying Today?</h1>
        <p className="player-select-subtitle">Each child keeps their own letters, stars, and progress.</p>
      </div>

      <div className="player-grid stagger">
        {players.map(({ id, profile }) => (
          <button type="button" key={id} className={`player-tile${id === activePlayerId ? ' is-active' : ''}`} onClick={() => handlePick(id)}>
            <div className="player-tile-avatar">
              <AvatarIcon avatar={profile.avatar} size={76} />
              {id === activePlayerId && (
                <span className="player-tile-active-badge" aria-label="Last flyer">
                  <CheckIcon size={11} />
                </span>
              )}
            </div>
            <span className="player-tile-name">{profile.name}</span>
          </button>
        ))}

        <button
          type="button"
          className="player-tile player-tile-add"
          onClick={() => {
            sfx.unlock();
            sfx.play('tap');
            setAdding(true);
          }}
        >
          <div className="player-tile-avatar player-tile-add-icon">
            <svg viewBox="0 0 24 24" width={28} height={28} aria-hidden="true">
              <path d="M12,5 L12,19 M5,12 L19,12" stroke="var(--sky-dark)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <span className="player-tile-name">Add a player</span>
        </button>
      </div>
    </div>
  );
}
