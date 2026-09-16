import { getZoneById } from '../engine/zones';
import { CompanionIcon } from '../components/icons/CompanionIcon';
import './ChapterComplete.css';

/**
 * Shown once, the moment a zone's letters are all mastered — see
 * docs/04-screens-spec.md#chapter-complete. Bigger than the per-letter
 * Celebration screen: this is the "new friend joins the journey" beat.
 */
export function ChapterComplete({ zoneId, onContinue }: { zoneId: string; onContinue: () => void }) {
  const zone = getZoneById(zoneId);
  if (!zone) return null;

  return (
    <div className="chapter" style={{ background: zone.accentWash }}>
      <span className="chapter-eyebrow" style={{ color: zone.accentDark }}>
        Chapter Complete
      </span>
      <h1 className="font-display chapter-title" style={{ color: zone.accentDark }}>
        You found the {zone.name} melody!
      </h1>
      <p className="chapter-sub">Every letter here remembered its sound — Buddy's song just grew a whole verse stronger.</p>

      <div className="companion-frame" style={{ background: 'var(--surface)' }}>
        <CompanionIcon id={zone.companion.id} size={130} />
      </div>

      <span className="font-display companion-name" style={{ color: zone.accentDark }}>
        {zone.companion.name}
      </span>
      <p className="companion-blurb">{zone.companion.blurb}</p>

      <button type="button" className="btn btn-primary font-display" style={{ marginTop: 26 }} onClick={onContinue}>
        Add {zone.companion.name.split(' ')[0]} to my journey!
      </button>
    </div>
  );
}
