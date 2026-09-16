import { useState } from 'react';
import { CURRICULUM_ORDER } from '../data/curriculum';
import { RESEARCH_LINKS } from '../data/research';
import { OFFLINE_ACTIVITIES } from '../data/offlineActivities';
import { displayWordForLetter } from '../engine/wordBank';
import { computeStreak, last7Days, weeklyMinutes } from '../engine/stats';
import { useApp } from '../state/AppContext';
import { AvatarIcon } from '../components/icons/AvatarIcon';
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon, StarIcon, SoundOnIcon, SoundOffIcon, BookIcon, CloseIcon, NestIcon } from '../components/icons/Misc';
import * as sfx from '../engine/sfx';
import './Dashboard.css';

function boxClass(box: number): string {
  if (box >= 4) return 'mastered';
  if (box >= 1) return 'practicing';
  return 'unstarted';
}

const MISSION_DURATION_PRESETS = [120, 240, 360, 480]; // 2 / 4 / 6 / 8 minutes

export function Dashboard({ onBack, onSwitchPlayer }: { onBack: () => void; onSwitchPlayer: () => void }) {
  const { state, players, setMissionDuration, setSoundEnabled, setWritingPractice, resetProgress } = useApp();
  const { letters, profile } = state;
  // Two-step, in-app confirmation instead of a browser confirm() dialog —
  // the native dialog looks like a crash to a parent and can be styled
  // by nothing. Arming resets itself after a few seconds untouched.
  const [resetArmed, setResetArmed] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [activityIndex, setActivityIndex] = useState(0);
  if (!profile) return null;

  const activity = OFFLINE_ACTIVITIES[activityIndex];
  function stepActivity(delta: number) {
    sfx.play('tap');
    setActivityIndex((i) => (i + delta + OFFLINE_ACTIVITIES.length) % OFFLINE_ACTIVITIES.length);
  }

  function armReset() {
    setResetArmed(true);
    setTimeout(() => setResetArmed(false), 5000);
  }

  function confirmReset() {
    resetProgress();
    setResetArmed(false);
  }

  // "Needs more practice" only ever includes letters actually attempted
  // — see docs/09-roadmap.md changelog for the inconsistency this fixes
  // relative to the original mockup (Elephant/Fish appeared there before
  // those letters were ever reachable).
  const known = CURRICULUM_ORDER.filter((l) => (letters[l]?.box ?? 0) >= 4);
  const needsPractice = CURRICULUM_ORDER.filter((l) => {
    const p = letters[l];
    return p && p.box >= 1 && p.box < 4 && p.attempts > 0;
  });
  const started = CURRICULUM_ORDER.filter((l) => (letters[l]?.attempts ?? 0) > 0).length;

  const week = last7Days(state.sessions);
  const daysThisWeek = week.filter((d) => d.practiced).length;
  const streak = computeStreak(state.sessions);
  const minutes = weeklyMinutes(state.sessions);
  const totalSessions = state.sessions.length;
  const soundOn = state.settings.soundEnabled;

  return (
    <div className="dashboard">
      <header className="dash-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ChevronLeftIcon size={18} /> Back to the game
        </button>
        <div className="dash-identity">
          <AvatarIcon avatar={profile.avatar} size={56} />
          <div>
            <h1 className="font-display dash-title">{profile.name}'s Progress</h1>
            <p className="dash-subtitle">Grown-ups' corner · age {profile.age}</p>
          </div>
        </div>
      </header>

      <section className="dash-stats" aria-label="At a glance">
        <div className="dash-stat">
          <span className="dash-stat-value">
            <StarIcon size={20} color="var(--sun-dark)" /> {state.starsTotal}
          </span>
          <span className="dash-stat-label">stars earned</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-value">{known.length}</span>
          <span className="dash-stat-label">of 26 mastered</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-value">{streak}</span>
          <span className="dash-stat-label">day streak</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-value">{minutes}</span>
          <span className="dash-stat-label">min this week</span>
        </div>
      </section>

      <div className="dash-grid">
        <div className="card dash-card">
          <div className="dash-card-head">
            <h2 className="font-display dash-card-title">Alphabet Mastery</h2>
            <div className="legend">
              <span className="legend-item">
                <span className="legend-dot mastered" />
                Mastered
              </span>
              <span className="legend-item">
                <span className="legend-dot practicing" />
                Practicing
              </span>
              <span className="legend-item">
                <span className="legend-dot unstarted" />
                Not started
              </span>
            </div>
          </div>
          <div className="alphabet-grid">
            {CURRICULUM_ORDER.map((l) => {
              const box = letters[l]?.box ?? 0;
              const p = letters[l];
              const title = p && p.attempts > 0 ? `${l}: ${p.correct} of ${p.attempts} correct` : `${l}: not met yet`;
              return (
                <div key={l} className={`alphabet-tile ${boxClass(box)}`} title={title}>
                  {l}
                  {box >= 4 && (
                    <span className="alphabet-tile-check">
                      <CheckIcon size={9} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="dash-fineprint">
            {started === 0
              ? 'No letters met yet — the first flight introduces them a few at a time.'
              : `${started} of 26 letters met so far. A letter counts as mastered after four correct answers in a row, spaced out over several flights.`}
          </p>
        </div>

        <div className="dash-column">
          <div className="card dash-card">
            <h2 className="font-display dash-card-title leaf">Words I Know Well</h2>
            <div className="word-list">
              {known.length === 0 && <span className="dash-empty">None yet — on the way!</span>}
              {known.map((l) => {
                const selfWords = letters[l]?.selfWords ?? [];
                return (
                  <div key={l}>
                    <div className="word-list-row leaf">
                      <span className="word-list-letter">{l}</span>
                      <span className="word-list-word">{displayWordForLetter(l, letters[l]?.lastWordId ?? null).word}</span>
                      <span className="word-list-check">
                        <CheckIcon size={11} />
                      </span>
                    </div>
                    {selfWords.length > 0 && <div className="word-list-self">also thought of: {selfWords.join(', ')}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card dash-card">
            <h2 className="font-display dash-card-title sun">Needs More Practice</h2>
            <div className="word-list">
              {needsPractice.length === 0 && <span className="dash-empty">Nothing in progress yet.</span>}
              {needsPractice.map((l) => (
                <div key={l} className="word-list-row sun">
                  <span className="word-list-letter">{l}</span>
                  <span className="word-list-word">{displayWordForLetter(l, letters[l]?.lastWordId ?? null).word}</span>
                  <span className="word-list-box" aria-label={`step ${letters[l]?.box ?? 0} of 4`}>
                    {Array.from({ length: 4 }, (_, i) => (
                      <span key={i} className={i < (letters[l]?.box ?? 0) ? 'on' : ''} />
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="dash-bottom">
        <div className="card dash-card">
          <h2 className="font-display dash-card-title">This Week</h2>
          <p className="dash-card-note">
            {daysThisWeek === 0 ? 'No flights yet this week.' : `${daysThisWeek} ${daysThisWeek === 1 ? 'day' : 'days'} with a flight · ${totalSessions} ${totalSessions === 1 ? 'flight' : 'flights'} all-time`}
          </p>
          <div className="week-row">
            {week.map((d) => (
              <div key={d.date} className="week-day">
                <div className={`week-day-box${d.practiced ? ' practiced' : ''}`} />
                {d.label}
              </div>
            ))}
          </div>
        </div>

        <div className="card dash-card">
          <h2 className="font-display dash-card-title">Flight Length</h2>
          <p className="dash-card-note">How long each flight runs, morning to night.</p>
          <div className="dash-segmented" role="radiogroup" aria-label="Flight length">
            {MISSION_DURATION_PRESETS.map((seconds) => {
              const active = state.settings.missionDurationSeconds === seconds;
              return (
                <button
                  key={seconds}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`dash-segment${active ? ' active' : ''}`}
                  onClick={() => {
                    sfx.play('tap');
                    setMissionDuration(seconds);
                  }}
                >
                  {seconds / 60} min
                </button>
              );
            })}
          </div>
        </div>

        <div className="card dash-card">
          <h2 className="font-display dash-card-title">Writing Practice</h2>
          <p className="dash-card-note">
            Every few traced letters, a lined page asks {profile.name} to write the letter three times. "Help first" shows the golden guide for the first one only, then it's written unaided.
          </p>
          <div className="dash-segmented" role="radiogroup" aria-label="Writing practice">
            {(
              [
                ['off', 'Off'],
                ['first-assisted', 'Help first'],
                ['always-assisted', 'Always help'],
              ] as const
            ).map(([value, label]) => {
              const active = state.settings.writingPractice === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`dash-segment${active ? ' active' : ''}`}
                  onClick={() => {
                    sfx.play('tap');
                    setWritingPractice(value);
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card dash-card">
          <h2 className="font-display dash-card-title">Sounds</h2>
          <p className="dash-card-note">Chimes, wind and sea. Spoken letters always play.</p>
          <button
            type="button"
            className={`dash-toggle${soundOn ? ' on' : ''}`}
            role="switch"
            aria-checked={soundOn}
            onClick={() => {
              sfx.unlock();
              setSoundEnabled(!soundOn);
              if (!soundOn) setTimeout(() => sfx.play('tap'), 60);
            }}
          >
            {soundOn ? <SoundOnIcon size={18} /> : <SoundOffIcon size={18} />}
            {soundOn ? 'Sounds on' : 'Sounds off'}
          </button>
        </div>

        <div className="card dash-card">
          <h2 className="font-display dash-card-title">The Research</h2>
          <p className="dash-card-note">Why the game teaches this way — tap, trace, type, say it, spot it, find the plane — instead of just one way.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              sfx.play('tap');
              setResearchOpen(true);
            }}
          >
            <BookIcon size={16} /> See the research
          </button>
        </div>

        <div className="card dash-card dash-card-activities">
          <h2 className="font-display dash-card-title sky">
            <NestIcon size={17} color="var(--sky-dark)" /> Off-Screen Albatross Adventures
          </h2>
          <p className="dash-card-note">Three ways to keep practicing letters and sounds away from the screen, in the same spirit as the game.</p>
          <div className="activity-carousel">
            <button type="button" className="activity-nav" onClick={() => stepActivity(-1)} aria-label="Previous activity">
              <ChevronLeftIcon size={18} color="var(--sky-dark)" />
            </button>
            <div className="activity-slide" key={activity.id}>
              <h3 className="activity-title">{activity.title}</h3>
              <p className="activity-tagline">{activity.tagline}</p>
              <ol className="activity-steps">
                {activity.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
            <button type="button" className="activity-nav" onClick={() => stepActivity(1)} aria-label="Next activity">
              <ChevronRightIcon size={18} color="var(--sky-dark)" />
            </button>
          </div>
          <div className="activity-dots" role="tablist" aria-label="Activity">
            {OFFLINE_ACTIVITIES.map((a, i) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={i === activityIndex}
                aria-label={a.title}
                className={`activity-dot${i === activityIndex ? ' active' : ''}`}
                onClick={() => {
                  sfx.play('tap');
                  setActivityIndex(i);
                }}
              />
            ))}
          </div>
        </div>

        <div className="card dash-card">
          <h2 className="font-display dash-card-title">Players</h2>
          <p className="dash-card-note">
            {players.length > 1 ? `${players.length} children share this device, each with their own progress.` : 'Add a sibling to give them their own separate progress.'}
          </p>
          <button type="button" className="btn btn-secondary" onClick={onSwitchPlayer}>
            Switch player
          </button>
        </div>

        <div className="card dash-card dash-card-danger">
          <h2 className="font-display dash-card-title coral">Reset Progress</h2>
          <p className="dash-card-note">
            Clears every letter's mastery, stars, and flight history so {profile.name} can start from the beginning. Profile and settings stay. Cannot be undone.
          </p>
          {resetArmed ? (
            <div className="dash-reset-confirm">
              <span>Really reset everything?</span>
              <button type="button" className="btn dash-reset-yes" onClick={confirmReset}>
                Yes, reset
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setResetArmed(false)}>
                Keep it
              </button>
            </div>
          ) : (
            <button type="button" className="btn dash-reset-btn" onClick={armReset}>
              Reset all progress
            </button>
          )}
        </div>
      </div>

      {researchOpen && (
        <div className="research-overlay" role="dialog" aria-modal="true" aria-label="The research behind this game">
          <div className="research-card">
            <button type="button" className="research-close" onClick={() => setResearchOpen(false)} aria-label="Close">
              <CloseIcon size={16} color="var(--ink-soft, #7a6b5a)" />
            </button>
            <h2 className="font-display">The research behind this game</h2>
            <p className="research-intro">
              A short, real reading list — not an exhaustive bibliography — on why the game teaches letters and sounds the
              way it does, plus the American Academy of Pediatrics' own guidance on screen use alongside it.
            </p>
            <ul className="research-list">
              {RESEARCH_LINKS.map((link) => (
                <li key={link.url} className="research-item">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="research-link">
                    {link.title}
                  </a>
                  <span className="research-source">{link.source}</span>
                  <p className="research-blurb">{link.blurb}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
