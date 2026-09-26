import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import { CURRICULUM_ORDER } from '../data/curriculum';
import { COMPANIONS, type CompanionSpec } from '../data/companions';
import { FLASHCARDS } from '../data/flashcards';
import { last7Days } from '../engine/stats';
import { speak, sayLetter } from '../engine/audio';
import { getFlashCardImageUrl } from '../three/flashCardTexture';
import * as sfx from '../engine/sfx';
import { ArrowLeftIcon, SpeakerIcon, CloseIcon } from '../components/icons/Misc';
import './Nest.css';

// "My Nest" — the child's own progress report. Everything the grown-ups'
// dashboard shows in numbers, told as a picture a 5-year-old can read:
// every letter is an egg in the albatross's nest — resting (not met
// yet), warming (being practised: speckled, cracked, wobbling) or
// hatched into a chick (mastered). Letters mastered since the last visit
// hatch on screen, one after another, which is the first thing the child
// sees. Deliberately NO accuracy, no "needs practice", no red: a child's
// report only ever shows growth. The screen talks — most players can't
// read yet.

type EggState = 'resting' | 'warming' | 'hatched';

/** At most this many hatch on screen per visit (a first visit could owe 20) — the rest are simply already chicks. */
const MAX_HATCHES = 6;
const HATCH_START_MS = 900;
const HATCH_GAP_MS = 1100;
const CRACK_MS = 650;
const STAR_JAR_SIZE = 100;

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function listOf(letters: string[]): string {
  if (letters.length <= 1) return letters.join('');
  return `${letters.slice(0, -1).join(', ')} and ${letters[letters.length - 1]}`;
}

export function NestScreen({ onBack }: { onBack: () => void }) {
  const { state, markNestSeen } = useApp();
  const name = state.profile?.name ?? '';

  const eggs = useMemo(
    () =>
      CURRICULUM_ORDER.map((letter) => {
        const p = state.letters[letter];
        const status: EggState = p && p.box >= 4 ? 'hatched' : p && p.attempts > 0 ? 'warming' : 'resting';
        return { letter, status, masteredAt: p?.masteredAt ?? null };
      }),
    [state.letters],
  );
  const hatched = eggs.filter((e) => e.status === 'hatched').map((e) => e.letter);

  // Snapshotted once per visit: which chicks are new since last time.
  const [newChicks] = useState<string[]>(() => {
    const seen = new Set(state.nestSeen ?? []);
    return eggs
      .filter((e) => e.status === 'hatched' && !seen.has(e.letter))
      .sort((a, b) => (a.masteredAt ?? '').localeCompare(b.masteredAt ?? ''))
      .slice(-MAX_HATCHES)
      .map((e) => e.letter);
  });
  // Per new chick: still an egg → 'cracking' (a hard wobble, cracks) → hatched.
  const [hatchStage, setHatchStage] = useState<Record<string, 'egg' | 'cracking' | 'done'>>(() =>
    Object.fromEntries(newChicks.map((l) => [l, prefersReducedMotion() ? 'done' : 'egg'])),
  );

  const nextCompanion = COMPANIONS.find((c) => c.unlockAt > hatched.length) ?? null;
  const summary = useMemo(() => {
    const parts: string[] = [];
    if (hatched.length === 0) parts.push('Your eggs are warming up! Catch letters on your flights to hatch them.');
    else parts.push(`You've hatched ${hatched.length} letter${hatched.length === 1 ? '' : 's'}!`);
    if (newChicks.length > 0) parts.push(`New ${newChicks.length === 1 ? 'chick' : 'chicks'}: ${listOf(newChicks)}!`);
    if (nextCompanion && hatched.length > 0) {
      const more = nextCompanion.unlockAt - hatched.length;
      parts.push(`${more} more and a ${nextCompanion.name} joins your flock!`);
    } else if (!nextCompanion) parts.push('Your whole flock is here!');
    return parts.join(' ');
  }, [hatched.length, newChicks, nextCompanion]);

  // The one orchestrated moment: new chicks hatch in turn, then the nest talks.
  const said = useRef(false);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const reduced = prefersReducedMotion();
    newChicks.forEach((letter, i) => {
      if (reduced) return;
      const at = HATCH_START_MS + i * HATCH_GAP_MS;
      timers.push(setTimeout(() => setHatchStage((s) => ({ ...s, [letter]: 'cracking' })), at));
      timers.push(
        setTimeout(() => {
          setHatchStage((s) => ({ ...s, [letter]: 'done' }));
          sfx.play('pop');
        }, at + CRACK_MS),
      );
    });
    const talkAt = reduced || newChicks.length === 0 ? 600 : HATCH_START_MS + newChicks.length * HATCH_GAP_MS + 300;
    timers.push(
      setTimeout(() => {
        if (newChicks.length > 0) sfx.play('bonus');
        markNestSeen(hatched);
        if (!said.current) {
          said.current = true;
          void speak(summary);
        }
      }, talkAt),
    );
    return () => timers.forEach(clearTimeout);
    // Once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [openLetter, setOpenLetter] = useState<string | null>(null);

  return (
    <div className="nest-screen">
      <header className="nest-header">
        <button
          type="button"
          className="nest-round-btn"
          onClick={() => {
            sfx.play('tap');
            onBack();
          }}
          aria-label="Back to the sky"
        >
          <ArrowLeftIcon size={22} color="currentColor" />
        </button>
        <h1 className="nest-title">{name ? `${name}'s nest` : 'My nest'}</h1>
        <button
          type="button"
          className="nest-round-btn"
          onClick={() => {
            sfx.play('tap');
            void speak(summary);
          }}
          aria-label="Hear it again"
        >
          <SpeakerIcon color="currentColor" />
        </button>
      </header>

      <p className="nest-summary" aria-live="polite">
        {summary}
      </p>

      <section className="nest" aria-label="Letter eggs">
        <div className="nest-eggs">
          {eggs.map((e) => {
            const stage = hatchStage[e.letter];
            const shown: EggState = stage === 'egg' || stage === 'cracking' ? 'warming' : e.status;
            return (
              <button
                key={e.letter}
                type="button"
                className={`nest-egg is-${shown}${stage === 'cracking' ? ' is-cracking' : ''}${stage === 'done' ? ' just-hatched' : ''}`}
                style={{ ['--wobble-delay' as string]: `${(e.letter.charCodeAt(0) * 0.37) % 3}s` }}
                onClick={() => {
                  sfx.play('tap');
                  setOpenLetter(e.letter);
                }}
                aria-label={`${e.letter}: ${shown === 'hatched' ? 'hatched' : shown === 'warming' ? 'getting ready to hatch' : 'not met yet'}`}
              >
                {shown === 'hatched' ? <Chick letter={e.letter} /> : <Egg letter={e.letter} warming={shown === 'warming'} />}
              </button>
            );
          })}
        </div>
        <NestRim />
      </section>

      <section className="nest-keepsakes">
        <StarJar stars={state.starsTotal} />
        <Flock hatchedCount={hatched.length} next={nextCompanion} />
        <Week sessions={state.sessions} />
      </section>

      {openLetter && <LetterCard letter={openLetter} status={eggs.find((e) => e.letter === openLetter)!.status} onClose={() => setOpenLetter(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const EGG_PATH = 'M30 3 C46 3 57 28 57 46 C57 64 45 75 30 75 C15 75 3 64 3 46 C3 28 14 3 30 3 Z';

function Egg({ letter, warming }: { letter: string; warming: boolean }) {
  return (
    <svg viewBox="0 0 60 78" className="egg-svg" aria-hidden="true">
      <path d={EGG_PATH} className="egg-shell" />
      {warming && (
        <>
          <circle cx="18" cy="30" r="2.2" className="egg-speckle" />
          <circle cx="40" cy="22" r="1.6" className="egg-speckle" />
          <circle cx="44" cy="52" r="2" className="egg-speckle" />
          <circle cx="15" cy="58" r="1.4" className="egg-speckle" />
          <path d="M34 8 L30 16 L36 20 L31 28" className="egg-crack" />
        </>
      )}
      <text x="30" y="55" className="egg-letter">
        {letter}
      </text>
    </svg>
  );
}

function Chick({ letter }: { letter: string }) {
  return (
    <svg viewBox="0 0 60 78" className="egg-svg" aria-hidden="true">
      {/* the top of the shell, flying off as it hatches (only animates on .just-hatched) */}
      <path d="M8 34 C10 14 20 3 30 3 C40 3 50 14 52 34 L45 28 L39 35 L32 27 L25 35 L18 28 Z" className="shell-top" />
      <g className="chick">
        <circle cx="30" cy="36" r="19" className="chick-body" />
        <path d="M26 18 C27 12 31 12 30 18 C33 13 36 15 33 19" className="chick-tuft" />
        <circle cx="23" cy="33" r="2.6" className="chick-eye" />
        <circle cx="37" cy="33" r="2.6" className="chick-eye" />
        <circle cx="23.8" cy="32.2" r="0.9" className="chick-glint" />
        <circle cx="37.8" cy="32.2" r="0.9" className="chick-glint" />
        <path d="M26.5 39 L33.5 39 L30 44 Z" className="chick-beak" />
        <path d="M11 42 C7 38 8 33 13 34" className="chick-wing" />
        <path d="M49 42 C53 38 52 33 47 34" className="chick-wing" />
      </g>
      {/* the bottom half of the shell the chick sits in, carrying its letter */}
      <path d="M3 46 L10 40 L17 47 L24 40 L31 47 L38 40 L45 47 L52 40 L57 46 C57 64 45 75 30 75 C15 75 3 64 3 46 Z" className="shell-cup" />
      <text x="30" y="67" className="egg-letter on-cup">
        {letter}
      </text>
      <g className="sparkles">
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <path key={deg} d="M30 2 L31.5 6 L30 10 L28.5 6 Z" className="sparkle" style={{ transform: `rotate(${deg}deg)` }} />
        ))}
      </g>
    </svg>
  );
}

/** Messy twigs along the nest's top edge — what makes the woven bowl read as a nest, not a basket. */
function NestRim() {
  const dome = (x: number) => 30 - 16 * Math.sin((Math.PI * x) / 400);
  return (
    <svg className="nest-rim" viewBox="0 0 400 44" preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: 34 }, (_, i) => {
        const x = (i / 33) * 400;
        const y = dome(x) + ((i * 7) % 5) - 2;
        const len = 18 + ((i * 11) % 16);
        const tilt = ((i * 13) % 9) - 4;
        return <path key={i} d={`M${x - len} ${y + tilt} Q${x} ${y - 6} ${x + len} ${y - tilt}`} className={`twig t${i % 3}`} />;
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */

function useCountUp(target: number, ms = 1200): number {
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0);
  useEffect(() => {
    if (prefersReducedMotion()) return setValue(target);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

function starPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }).join(' ');
}

/** Stars pile up in a glass jar; every full jar goes on the shelf beside it. */
function StarJar({ stars }: { stars: number }) {
  const shown = useCountUp(stars);
  const fullJars = Math.floor(stars / STAR_JAR_SIZE);
  const inJar = stars % STAR_JAR_SIZE;
  // The pile's height is the honest part: a full jar is 11 rows of 6
  // stars, so 37 of 100 fills a bit over a third of it.
  const drawn = Math.round((Math.min(inJar, STAR_JAR_SIZE) / STAR_JAR_SIZE) * 66);
  const pile = useMemo(
    () =>
      Array.from({ length: drawn }, (_, i) => {
        const row = Math.floor(i / 6);
        const col = i % 6;
        return { x: 22 + col * 12 + (row % 2) * 5 + ((i * 7) % 4) - 2, y: 119 - row * 9 - ((i * 3) % 3), r: 5.5 + ((i * 5) % 3) * 0.7, rot: (i * 37) % 60 };
      }),
    [drawn],
  );
  return (
    <figure className="keepsake jar-keepsake">
      <svg viewBox="0 0 110 132" className="jar-svg" aria-hidden="true">
        <rect x="30" y="4" width="50" height="14" rx="4" className="jar-lid" />
        <path d="M24 20 H86 C92 20 96 26 96 34 V116 C96 124 90 128 82 128 H28 C20 128 14 124 14 116 V34 C14 26 18 20 24 20 Z" className="jar-glass" />
        {pile.map((p, i) => (
          <polygon key={i} points={starPoints(p.x, p.y, p.r)} className="jar-star" style={{ transform: `rotate(${p.rot}deg)`, transformOrigin: `${p.x}px ${p.y}px`, animationDelay: `${0.3 + i * 0.04}s` }} />
        ))}
        <path d="M22 32 C20 60 20 90 22 116" className="jar-shine" />
      </svg>
      {fullJars > 0 && (
        <div className="jar-shelf" aria-hidden="true">
          {Array.from({ length: Math.min(fullJars, 5) }, (_, i) => (
            <span key={i} className="mini-jar" />
          ))}
        </div>
      )}
      <figcaption>
        <strong>{shown}</strong> {stars === 1 ? 'star' : 'stars'}
      </figcaption>
    </figure>
  );
}

function Critter({ spec, locked }: { spec: CompanionSpec; locked: boolean }) {
  const body = locked ? '#b9c6cf' : spec.bodyLight;
  const dark = locked ? '#9aa9b3' : spec.body;
  const wing = locked ? '#d7e0e6' : spec.wing;
  return (
    <svg viewBox="0 0 40 32" className={`critter${locked ? ' locked' : ''}`} aria-hidden="true">
      {spec.id === 'flying-fish' ? (
        <>
          <path d="M6 16 C12 8 26 8 32 16 C26 24 12 24 6 16 Z" fill={body} />
          <path d="M32 16 L39 10 L38 22 Z" fill={dark} />
          <path d="M16 13 C18 4 26 3 28 6 C24 8 21 11 20 14 Z" fill={wing} opacity="0.9" />
          <circle cx="11" cy="15" r="1.6" fill={dark} />
        </>
      ) : spec.id === 'chick' || spec.id === 'owlet' ? (
        <>
          <ellipse cx="20" cy="19" rx="11" ry="10" fill={body} />
          <path d="M9 18 C4 14 6 10 11 13" fill={wing} />
          <path d="M31 18 C36 14 34 10 29 13" fill={wing} />
          <circle cx="16" cy="16" r={spec.id === 'owlet' ? 3 : 1.6} fill={spec.id === 'owlet' ? '#fff' : dark} />
          <circle cx="24" cy="16" r={spec.id === 'owlet' ? 3 : 1.6} fill={spec.id === 'owlet' ? '#fff' : dark} />
          {spec.id === 'owlet' && (
            <>
              <circle cx="16" cy="16" r="1.4" fill={dark} />
              <circle cx="24" cy="16" r="1.4" fill={dark} />
            </>
          )}
          <path d="M18.5 20 L21.5 20 L20 22.5 Z" fill="#f08c2a" />
        </>
      ) : (
        <>
          {/* bugs: firefly, bee, dragonfly, butterfly */}
          <ellipse cx="13" cy={spec.id === 'butterfly' ? 10 : 11} rx={spec.id === 'butterfly' ? 10 : 8} ry={spec.id === 'butterfly' ? 9 : 6} fill={wing} opacity="0.95" />
          <ellipse cx="27" cy={spec.id === 'butterfly' ? 10 : 11} rx={spec.id === 'butterfly' ? 10 : 8} ry={spec.id === 'butterfly' ? 9 : 6} fill={wing} opacity="0.95" />
          {spec.id === 'butterfly' && (
            <>
              <ellipse cx="14" cy="22" rx="7" ry="6" fill={body} />
              <ellipse cx="26" cy="22" rx="7" ry="6" fill={body} />
            </>
          )}
          <ellipse cx="20" cy="18" rx={spec.id === 'dragonfly' ? 3 : 6} ry={spec.id === 'dragonfly' ? 11 : 8} fill={spec.id === 'butterfly' ? dark : body} />
          {spec.stripes && !locked && (
            <>
              <rect x="14" y="15" width="12" height="2.4" fill={dark} />
              <rect x="14" y="20" width="12" height="2.4" fill={dark} />
            </>
          )}
          {spec.id === 'firefly' && !locked && <circle cx="20" cy="24" r="5" fill="#fff59a" opacity="0.8" className="firefly-glow" />}
          <circle cx="20" cy="9" r="3.2" fill={dark} />
        </>
      )}
    </svg>
  );
}

/** Friends already flying with the albatross, and the next one waiting as a shadow with dots to go. */
function Flock({ hatchedCount, next }: { hatchedCount: number; next: CompanionSpec | null }) {
  const joined = COMPANIONS.filter((c) => c.unlockAt <= hatchedCount);
  const prevAt = next ? [...COMPANIONS].reverse().find((c) => c.unlockAt <= hatchedCount)?.unlockAt ?? 0 : 0;
  const span = next ? next.unlockAt - prevAt : 0;
  const progress = next ? hatchedCount - prevAt : 0;
  return (
    <figure className="keepsake flock-keepsake">
      <div className="flock-sky">
        {joined.length === 0 && !next ? null : (
          <>
            {joined.map((c, i) => (
              <span key={c.id} className="flock-bird" style={{ ['--bob-delay' as string]: `${i * 0.4}s` }} title={c.name}>
                <Critter spec={c} locked={false} />
              </span>
            ))}
            {next && (
              <span className="flock-next" title={`Next: ${next.name}`}>
                <Critter spec={next} locked />
                <span className="flock-dots" aria-label={`${next.unlockAt - hatchedCount} more letters`}>
                  {Array.from({ length: span }, (_, i) => (
                    <i key={i} className={i < progress ? 'filled' : ''} />
                  ))}
                </span>
              </span>
            )}
          </>
        )}
      </div>
      <figcaption>
        {joined.length === 0 ? 'Hatch a letter to meet your first friend' : `${joined.length} ${joined.length === 1 ? 'friend' : 'friends'} flying with you`}
      </figcaption>
    </figure>
  );
}

/** The last seven days as suns: bright for a day flown, sleepy for a day off. */
function Week({ sessions }: { sessions: Parameters<typeof last7Days>[0] }) {
  const days = last7Days(sessions);
  const flown = days.filter((d) => d.practiced).length;
  return (
    <figure className="keepsake week-keepsake">
      <ol className="week-suns">
        {days.map((d, i) => (
          <li key={d.date} className={d.practiced ? 'flown' : 'rest'} style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
            <svg viewBox="0 0 40 40" aria-hidden="true">
              {d.practiced ? (
                <>
                  {Array.from({ length: 8 }, (_, k) => (
                    <path key={k} d="M20 2 L22 8 L18 8 Z" className="sun-ray" style={{ transform: `rotate(${k * 45}deg)`, transformOrigin: '20px 20px' }} />
                  ))}
                  <circle cx="20" cy="20" r="10" className="sun-disc" />
                  <path d="M15.5 21.5 Q20 25.5 24.5 21.5" className="sun-smile" />
                </>
              ) : (
                <>
                  <circle cx="20" cy="20" r="10" className="sun-sleepy" />
                  <path d="M15 19 Q17 20.5 19 19 M21 19 Q23 20.5 25 19" className="sun-closed-eyes" />
                </>
              )}
            </svg>
            <span className="week-day">{d.label}</span>
          </li>
        ))}
      </ol>
      <figcaption>
        {flown === 0 ? 'Fly today to wake up a sun' : `${flown} sunny ${flown === 1 ? 'day' : 'days'} this week`}
      </figcaption>
    </figure>
  );
}

/** Tap an egg or chick: its letter, both cases, a picture of a word it starts, spoken aloud. */
function LetterCard({ letter, status, onClose }: { letter: string; status: EggState; onClose: () => void }) {
  const { state } = useApp();
  const card = useMemo(() => FLASHCARDS.find((c) => c.letter === letter) ?? null, [letter]);
  const [picture, setPicture] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (card) void getFlashCardImageUrl(card.id).then((url) => live && setPicture(url));
    void sayLetter(letter, state.settings.letterVoice).then(() => {
      if (live && card) void speak(card.word);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter]);
  return (
    <div className="nest-card-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`The letter ${letter}`}>
      <div className="nest-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="nest-card-close" onClick={onClose} aria-label="Close">
          <CloseIcon size={16} color="currentColor" />
        </button>
        <div className="nest-card-letters">
          <span>{letter}</span>
          <span>{letter.toLowerCase()}</span>
        </div>
        {picture && <img src={picture} alt="" className="nest-card-picture" />}
        {card && <p className="nest-card-word">{card.word}</p>}
        <p className="nest-card-note">
          {status === 'hatched' ? 'Hatched! You know this one.' : status === 'warming' ? 'Almost ready to hatch — keep catching it!' : 'Still resting. You’ll meet it on a flight soon.'}
        </p>
        <button
          type="button"
          className="nest-card-replay"
          onClick={() => void sayLetter(letter, state.settings.letterVoice).then(() => card && speak(card.word))}
        >
          <SpeakerIcon color="currentColor" /> Hear it
        </button>
      </div>
    </div>
  );
}
