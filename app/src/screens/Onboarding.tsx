import { useState } from 'react';
import type { Avatar, Profile, ReadingLevel } from '../types';
import { useApp } from '../state/AppContext';
import { AVATARS, AVATAR_LABELS } from '../data/avatars';
import { AvatarIcon } from '../components/icons/AvatarIcon';
import { Wordmark } from '../components/Brand';
import { CheckIcon, ChevronLeftIcon } from '../components/icons/Misc';
import * as sfx from '../engine/sfx';
import './Onboarding.css';

const AGES = [3, 4, 5, 6, 7, 8, 9];
const LEVELS: { id: ReadingLevel; title: string; caption: string }[] = [
  { id: 'starting', title: 'Just starting out', caption: 'New to letters & sounds' },
  { id: 'some-letters', title: 'I know some letters', caption: 'Recognize a few already' },
  { id: 'fluent-reader', title: 'I can already read!', caption: 'Fluent in another language' },
];

interface OnboardingProps {
  /** Fires right after the new profile is created and made active — used when this is embedded inside PlayerSelect to add a sibling, so the picker can hand off into the game. The very-first-launch usage (App.tsx) doesn't need this: becoming the active player is itself enough to leave this screen. */
  onCreated?: () => void;
  /** Shown (as a plain back link) when embedded as an "add another player" step, so a parent can back out without creating one. Omitted on first launch, where there's nothing to go back to. */
  onCancel?: () => void;
}

export function Onboarding({ onCreated, onCancel }: OnboardingProps = {}) {
  const { createProfile } = useApp();
  const [name, setName] = useState('');
  const [age, setAge] = useState(6);
  const [avatar, setAvatar] = useState<Avatar>('fox');
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>('some-letters');

  const canSubmit = name.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    sfx.unlock();
    sfx.play('bonus');
    const profile: Profile = {
      name: name.trim(),
      age,
      avatar,
      readingLevel,
      createdAt: new Date().toISOString(),
    };
    createProfile(profile);
    onCreated?.();
  }

  function tick() {
    sfx.unlock();
    sfx.play('tap');
  }

  return (
    <div className="onboarding">
      {onCancel && (
        <button type="button" className="back-link onboarding-back" onClick={onCancel}>
          <ChevronLeftIcon size={18} /> Back
        </button>
      )}
      <div className="onboarding-header stagger">
        <div className="onboarding-hero">
          <Wordmark width={360} />
        </div>
        <h1 className="font-display onboarding-title">{onCreated ? "Let's Meet Another Flyer!" : "Let's Meet You!"}</h1>
        <p className="onboarding-subtitle">
          {onCreated
            ? "Add another child's own profile — their letters, stars, and progress stay completely separate from everyone else's."
            : 'An albatross is flying home across the sea, and the letters it needs are hiding in the clouds. You already know every sound they make — now let’s find their shapes.'}
        </p>
      </div>

      <form
        className="card onboarding-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <div>
          <label className="field-label" htmlFor="name">
            What's your name?
          </label>
          <input
            id="name"
            className="name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Type your name…"
            maxLength={30}
            autoComplete="off"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
          />
        </div>

        <div>
          <span className="field-label" id="age-label">
            How old are you?
          </span>
          <div className="chip-row" role="radiogroup" aria-labelledby="age-label">
            {AGES.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={a === age}
                className={`age-chip${a === age ? ' selected' : ''}`}
                onClick={() => {
                  tick();
                  setAge(a);
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="field-label" id="avatar-label">
            Pick your avatar!
          </span>
          <div className="avatar-row" role="radiogroup" aria-labelledby="avatar-label">
            {AVATARS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={a.id === avatar}
                className={`avatar-btn${a.id === avatar ? ' selected' : ''}`}
                onClick={() => {
                  tick();
                  setAvatar(a.id);
                }}
                aria-label={AVATAR_LABELS[a.id]}
              >
                <AvatarIcon avatar={a.id} size={68} />
                {a.id === avatar && (
                  <span className="selected-badge">
                    <CheckIcon size={11} />
                  </span>
                )}
                <span className="avatar-name">{AVATAR_LABELS[a.id]}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="field-label" id="level-label">
            How much do you know already?
          </span>
          <div className="level-grid" role="radiogroup" aria-labelledby="level-label">
            {LEVELS.map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                role="radio"
                aria-checked={lvl.id === readingLevel}
                className={`level-card${lvl.id === readingLevel ? ' selected' : ''}`}
                onClick={() => {
                  tick();
                  setReadingLevel(lvl.id);
                }}
              >
                {lvl.id === readingLevel && (
                  <span className="selected-badge lg">
                    <CheckIcon size={12} />
                  </span>
                )}
                <span className="level-card-title">{lvl.title}</span>
                <span className="level-card-caption">{lvl.caption}</span>
              </button>
            ))}
          </div>
          <div className="esl-note">Made for children learning English as a new language — the sky goes at your pace.</div>
        </div>

        <button type="submit" className="btn btn-primary btn-lg font-display submit-btn" disabled={!canSubmit}>
          Start My Adventure
        </button>
      </form>
    </div>
  );
}
