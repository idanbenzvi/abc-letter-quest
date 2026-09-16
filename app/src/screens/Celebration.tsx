import { CURRICULUM_ORDER } from '../data/curriculum';
import { useApp } from '../state/AppContext';
import { BuddyIcon } from '../components/icons/BuddyIcon';
import './Celebration.css';

export function Celebration({ letter, onContinue }: { letter: string; onContinue: () => void }) {
  const { state } = useApp();

  return (
    <div className="celebration">
      <h1 className="font-display celebration-title">You found it!</h1>
      <div className="celebration-sub">
        <span>You knew the sound. Now you know its shape:</span>
        <span className="celebration-letter-chip font-display">
          {letter}
          {letter.toLowerCase()}
        </span>
      </div>

      <BuddyIcon pose="cheer" size={160} />

      <span className="song-line">Buddy's Letter-Song grows stronger!</span>

      <div className="badge-strip">
        {CURRICULUM_ORDER.map((l) => {
          const mastered = (state.letters[l]?.box ?? 0) >= 4;
          const isNew = l === letter;
          return (
            <div
              key={l}
              className="badge-slot"
              style={{
                background: mastered ? 'var(--leaf)' : 'var(--surface-2)',
                border: isNew ? '3px solid var(--sun-dark)' : mastered ? '3px solid var(--leaf-dark)' : '3px dashed var(--sky-wash)',
                boxShadow: isNew ? '0 0 0 5px var(--sun-wash)' : 'none',
              }}
            >
              {mastered ? l : ''}
            </div>
          );
        })}
      </div>

      <button type="button" className="btn btn-primary font-display" style={{ marginTop: 24 }} onClick={onContinue}>
        Keep Going!
      </button>
    </div>
  );
}
