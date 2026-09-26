import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import { AvatarIcon } from '../components/icons/AvatarIcon';
import { Wordmark } from '../components/Brand';
import { CheckIcon, ChevronLeftIcon, SoundOffIcon, SoundOnIcon } from '../components/icons/Misc';
import { SkyBackdrop } from '../components/SkyBackdrop';
import { Onboarding } from './Onboarding';
import * as sfx from '../engine/sfx';
import * as music from '../engine/music';
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
  const [musicMuted, setMusicMuted] = useState(music.isMuted());

  // The theme song plays behind the whole starting-menu flow (this screen
  // and, if "Add a player" is tapped, Onboarding on top of it) and fades
  // out once a player is picked and we leave for the Dashboard.
  useEffect(() => {
    music.play();
    return () => music.fadeOutAndStop();
  }, []);

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
    <div className="player-select sky-stage" onPointerDownCapture={() => music.resume()}>
      <SkyBackdrop />
      <div className="player-select-topbar">
        {onCancel ? (
          <button type="button" className="back-link onboarding-back" onClick={onCancel}>
            <ChevronLeftIcon size={18} /> Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="icon-btn"
          onClick={() => {
            const next = !musicMuted;
            music.setMuted(next);
            setMusicMuted(next);
          }}
          aria-label={musicMuted ? 'Unmute music' : 'Mute music'}
        >
          {musicMuted ? <SoundOffIcon size={18} /> : <SoundOnIcon size={18} />}
        </button>
      </div>
      <div className="player-select-header">
        <div className="onboarding-hero">
          <Wordmark width={300} />
        </div>
        <h1 className="font-display player-select-title">Who's Flying Today?</h1>
        <p className="player-select-subtitle">Each child keeps their own letters, stars, and progress.</p>
        <svg className="player-select-wave" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,7 C25,1 50,13 75,7 C100,1 125,13 150,7 C175,1 200,13 200,7" fill="none" stroke="var(--sky)" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>

      <div className="player-grid">
        {players.map(({ id, profile }) => (
          <button type="button" key={id} className={`player-tile${id === activePlayerId ? ' is-active' : ''}`} onClick={() => handlePick(id)}>
            <span className="player-tile-plaque">
              <div className="player-tile-avatar">
                <AvatarIcon avatar={profile.avatar} size={64} />
                {id === activePlayerId && (
                  <span className="player-tile-active-badge" aria-label="Last flyer">
                    <CheckIcon size={11} />
                  </span>
                )}
              </div>
              <span className="player-tile-name">{profile.name}</span>
            </span>
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
          <span className="player-tile-plaque">
            <div className="player-tile-avatar player-tile-add-icon">
              <svg viewBox="0 0 24 24" width={28} height={28} aria-hidden="true">
                <path d="M12,5 L12,19 M5,12 L19,12" stroke="var(--sky-dark)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
              </svg>
            </div>
            <span className="player-tile-name">Add a player</span>
          </span>
        </button>
      </div>
    </div>
  );
}
