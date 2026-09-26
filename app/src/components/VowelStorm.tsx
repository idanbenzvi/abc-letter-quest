import { useEffect, useState } from 'react';
import type { VowelRound } from '../engine/vowelRound';
import { getFlashCardImageUrl } from '../three/flashCardTexture';
import './VowelStorm.css';

export interface VowelStormState extends VowelRound {
  solved: boolean;
  /** Vowel just tapped wrong — that drop splashes. */
  wrong: string | null;
  /** After a couple of misses the right drop glows. */
  hint: boolean;
}

/**
 * Storm Vowels (see FlightGameScreen's openVowelStorm): the word with its
 * middle vowel missing — "C _ T" — and three vowel raindrops falling
 * through the storm. DOM rather than 3D so the letters stay crisp and the
 * drops are big, reliable tap targets on a phone; the rain, darkened sky
 * and lightning around it are the 3D storm (StormWeather.tsx).
 */
export function VowelStorm({ round, onPick }: { round: VowelStormState; onPick: (vowel: string) => void }) {
  const [picture, setPicture] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setPicture(null);
    if (round.cardId) void getFlashCardImageUrl(round.cardId).then((url) => live && setPicture(url));
    return () => {
      live = false;
    };
  }, [round.cardId]);

  return (
    <div className={`vowel-storm${round.solved ? ' solved' : ''}`}>
      <div className="vowel-board" aria-label={round.solved ? round.id : `${round.letters[0]}, blank, ${round.letters[2]}`}>
        {picture && <img className="vowel-picture" src={picture} alt="" />}
        <div className="vowel-tiles">
          <span className="vowel-tile">{round.letters[0]}</span>
          <span className={`vowel-tile gap${round.solved ? ' filled' : ''}`}>{round.solved ? round.vowel : ''}</span>
          <span className="vowel-tile">{round.letters[2]}</span>
        </div>
      </div>
      {!round.solved && (
        <div className="vowel-drops" role="group" aria-label="Pick the missing sound">
          {round.options.map((v, i) => (
            <button
              key={v}
              type="button"
              className={`vowel-drop lane-${i}${round.wrong === v ? ' splash' : ''}${round.hint && v === round.vowel ? ' hint' : ''}`}
              style={{ animationDelay: `${-i * 1.7}s` }}
              onClick={() => onPick(v)}
              aria-label={`The letter ${v}`}
            >
              <span>{v}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
