import { useId, type FC } from 'react';

// Hand-built word illustrations for the Phase 1 letters (A-F), in the
// flat-vector style from docs/03-design-system.md. See
// docs/08-asset-pipeline.md for how the rest of the alphabet gets
// covered — either more hand-built icons like these, or swapped for
// approved AI-generated art later, one word at a time.

interface IconProps {
  size?: number;
}

export const AppleIcon: FC<IconProps> = ({ size = 76 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
    <path
      d="M50,32 C32,32 20,46 20,63 C20,80 34,90 50,90 C66,90 80,80 80,63 C80,46 68,32 50,32 Z"
      fill="var(--coral)"
    />
    <ellipse cx="38" cy="54" rx="7" ry="10" fill="white" opacity="0.25" />
    <rect x="47" y="16" width="6" height="18" rx="3" fill="var(--sun-dark)" />
    <ellipse cx="62" cy="24" rx="11" ry="7" fill="var(--leaf)" transform="rotate(-25 62 24)" />
  </svg>
);

export const BallIcon: FC<IconProps> = ({ size = 76 }) => {
  const clipId = useId();
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="34" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="34" fill="var(--coral)" />
      <g clipPath={`url(#${clipId})`}>
        <ellipse cx="50" cy="38" rx="40" ry="9" fill="var(--surface)" />
        <ellipse cx="50" cy="62" rx="40" ry="9" fill="var(--sun)" />
      </g>
    </svg>
  );
};

export const CatIcon: FC<IconProps> = ({ size = 76 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
    <polygon points="24,38 16,14 38,30" fill="var(--berry)" />
    <polygon points="76,38 84,14 62,30" fill="var(--berry)" />
    <ellipse cx="50" cy="58" rx="30" ry="26" fill="var(--berry)" />
    <ellipse cx="50" cy="66" rx="19" ry="13" fill="var(--surface)" />
    <circle cx="41" cy="54" r="4.5" fill="var(--ink)" />
    <circle cx="59" cy="54" r="4.5" fill="var(--ink)" />
    <polygon points="46,63 54,63 50,68" fill="var(--ink)" />
  </svg>
);

export const DogIcon: FC<IconProps> = ({ size = 76 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
    <ellipse cx="50" cy="60" rx="34" ry="28" fill="var(--sun-dark)" opacity="0.75" />
    <polygon points="20,40 10,15 34,32" fill="var(--sun-dark)" opacity="0.75" />
    <polygon points="80,40 90,15 66,32" fill="var(--sun-dark)" opacity="0.75" />
    <ellipse cx="50" cy="68" rx="22" ry="16" fill="var(--surface)" />
    <circle cx="40" cy="54" r="5" fill="var(--ink)" />
    <circle cx="60" cy="54" r="5" fill="var(--ink)" />
    <ellipse cx="50" cy="66" rx="6" ry="4" fill="var(--ink)" />
    <path d="M42,74 Q50,80 58,74" stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

export const ElephantIcon: FC<IconProps> = ({ size = 76 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
    <ellipse cx="58" cy="62" rx="28" ry="20" fill="var(--sky)" />
    <circle cx="34" cy="46" r="19" fill="var(--sky)" />
    <ellipse cx="16" cy="43" rx="12" ry="16" fill="var(--sky-dark)" />
    <path d="M25,52 Q14,70 22,80 Q26,82 30,78" stroke="var(--sky-dark)" strokeWidth="7" fill="none" strokeLinecap="round" />
    <circle cx="31" cy="41" r="2.6" fill="var(--ink)" />
    <rect x="42" y="76" width="7" height="11" rx="3" fill="var(--sky-dark)" />
    <rect x="66" y="76" width="7" height="11" rx="3" fill="var(--sky-dark)" />
  </svg>
);

export const FishIcon: FC<IconProps> = ({ size = 76 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
    <ellipse cx="42" cy="52" rx="26" ry="18" fill="var(--sky)" />
    <polygon points="66,52 90,36 90,68" fill="var(--sky-dark)" />
    <path d="M36,38 Q44,28 52,38" stroke="var(--sky-dark)" strokeWidth="3" fill="none" strokeLinecap="round" />
    <circle cx="28" cy="48" r="3" fill="var(--ink)" />
    <ellipse cx="40" cy="56" rx="9" ry="5" fill="var(--sun)" opacity="0.6" />
  </svg>
);

const PLACEHOLDER_PALETTE = ['var(--coral)', 'var(--leaf)', 'var(--sky)', 'var(--sun-dark)', 'var(--berry)'];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Generic stand-in for any word that doesn't have a hand-built or
 * AI-generated icon yet (letters G-Z in Phase 1 — see
 * docs/08-asset-pipeline.md). Deliberately abstract rather than a bad
 * drawing pretending to be the real object.
 */
export const GenericWordIcon: FC<IconProps & { seed: string }> = ({ size = 76, seed }) => {
  const color = PLACEHOLDER_PALETTE[hashString(seed) % PLACEHOLDER_PALETTE.length];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <circle cx="50" cy="50" r="34" fill={color} opacity="0.85" />
      <circle cx="50" cy="50" r="34" fill="none" stroke={color} strokeWidth="3" strokeDasharray="2 8" opacity="0.6" />
    </svg>
  );
};

const ICONS: Record<string, FC<IconProps>> = {
  apple: AppleIcon,
  ball: BallIcon,
  cat: CatIcon,
  dog: DogIcon,
  elephant: ElephantIcon,
  fish: FishIcon,
};

/** Word ids with a real hand-built illustration — the only ones fair to
 * use in a "which picture starts with this letter" recognition task
 * (see engine/pictureChoice.ts). Generic-fallback words don't carry
 * enough visual identity for a child to name them. */
export const ILLUSTRATED_WORD_IDS: ReadonlySet<string> = new Set(Object.keys(ICONS));

export function WordIcon({ id, size = 76 }: { id: string; size?: number }) {
  const Icon = ICONS[id];
  if (Icon) return <Icon size={size} />;
  return <GenericWordIcon seed={id} size={size} />;
}
