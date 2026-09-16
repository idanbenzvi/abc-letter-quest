import type { Avatar } from '../../types';

// The five pickable player avatars, drawn as friendly faces in the same
// flat-vector style as the rest of the icon set (docs/03-design-system.md).
// Each one uses its own accent from the palette — see data/avatars.ts —
// so a player's avatar and their colour are always the same thing.
// Used wherever the child "is": onboarding, the player picker, the
// flight intro/pause cards.

const FACES: Record<Avatar, (size: number) => React.ReactNode> = {
  fox: () => (
    <>
      <polygon points="22,44 16,12 44,32" fill="var(--coral)" />
      <polygon points="78,44 84,12 56,32" fill="var(--coral)" />
      <polygon points="26,38 22,20 38,32" fill="var(--surface)" />
      <polygon points="74,38 78,20 62,32" fill="var(--surface)" />
      <circle cx="50" cy="56" r="30" fill="var(--coral)" />
      <ellipse cx="50" cy="66" rx="19" ry="14" fill="var(--surface)" />
      <circle cx="40" cy="52" r="4" fill="var(--ink)" />
      <circle cx="60" cy="52" r="4" fill="var(--ink)" />
      <ellipse cx="50" cy="62" rx="3.2" ry="2.3" fill="var(--ink-soft)" />
      <path d="M44,69 Q50,73 56,69" stroke="var(--ink)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </>
  ),
  bee: () => (
    <>
      <path d="M38,26 L30,12 M62,26 L70,12" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="30" cy="12" r="3.2" fill="var(--ink)" />
      <circle cx="70" cy="12" r="3.2" fill="var(--ink)" />
      <ellipse cx="24" cy="52" rx="12" ry="8" fill="white" opacity="0.75" transform="rotate(-25 24 52)" />
      <ellipse cx="76" cy="52" rx="12" ry="8" fill="white" opacity="0.75" transform="rotate(25 76 52)" />
      <circle cx="50" cy="54" r="30" fill="var(--sun)" />
      <path d="M22,62 Q50,72 78,62 L78,70 Q50,82 22,70 Z" fill="var(--ink)" opacity="0.55" />
      <circle cx="40" cy="50" r="4.2" fill="var(--ink)" />
      <circle cx="60" cy="50" r="4.2" fill="var(--ink)" />
      <path d="M45,59 Q50,63 55,59" stroke="var(--ink)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="33" cy="58" r="3.5" fill="var(--coral)" opacity="0.35" />
      <circle cx="67" cy="58" r="3.5" fill="var(--coral)" opacity="0.35" />
    </>
  ),
  owl: () => (
    <>
      <polygon points="26,34 20,14 40,28" fill="var(--sky-dark)" />
      <polygon points="74,34 80,14 60,28" fill="var(--sky-dark)" />
      <circle cx="50" cy="56" r="30" fill="var(--sky)" />
      <ellipse cx="50" cy="72" rx="16" ry="10" fill="var(--sky-wash)" />
      <circle cx="39" cy="50" r="11" fill="var(--surface)" />
      <circle cx="61" cy="50" r="11" fill="var(--surface)" />
      <circle cx="40" cy="51" r="5" fill="var(--ink)" />
      <circle cx="60" cy="51" r="5" fill="var(--ink)" />
      <circle cx="42" cy="49" r="1.6" fill="white" />
      <circle cx="62" cy="49" r="1.6" fill="white" />
      <polygon points="46,60 54,60 50,67" fill="var(--sun-dark)" />
    </>
  ),
  cat: () => (
    <>
      <polygon points="24,42 18,12 44,30" fill="var(--berry)" />
      <polygon points="76,42 82,12 56,30" fill="var(--berry)" />
      <polygon points="27,38 24,22 38,31" fill="var(--berry-wash)" />
      <polygon points="73,38 76,22 62,31" fill="var(--berry-wash)" />
      <circle cx="50" cy="56" r="30" fill="var(--berry)" />
      <ellipse cx="50" cy="66" rx="17" ry="11" fill="var(--surface)" />
      <circle cx="40" cy="52" r="4.2" fill="var(--ink)" />
      <circle cx="60" cy="52" r="4.2" fill="var(--ink)" />
      <polygon points="46,62 54,62 50,66.5" fill="var(--ink)" />
      <path d="M22,62 L36,64 M22,70 L36,68 M78,62 L64,64 M78,70 L64,68" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    </>
  ),
  rabbit: () => (
    <>
      <ellipse cx="38" cy="22" rx="9" ry="20" fill="var(--leaf)" transform="rotate(-10 38 22)" />
      <ellipse cx="62" cy="22" rx="9" ry="20" fill="var(--leaf)" transform="rotate(10 62 22)" />
      <ellipse cx="38" cy="23" rx="4" ry="14" fill="var(--leaf-wash)" transform="rotate(-10 38 23)" />
      <ellipse cx="62" cy="23" rx="4" ry="14" fill="var(--leaf-wash)" transform="rotate(10 62 23)" />
      <circle cx="50" cy="58" r="29" fill="var(--leaf)" />
      <ellipse cx="50" cy="68" rx="17" ry="12" fill="var(--surface)" />
      <circle cx="40" cy="54" r="4.2" fill="var(--ink)" />
      <circle cx="60" cy="54" r="4.2" fill="var(--ink)" />
      <ellipse cx="50" cy="63" rx="3" ry="2.2" fill="var(--berry)" />
      <path d="M50,65 L50,70 M46,72 Q50,75 54,72" stroke="var(--ink)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </>
  ),
};

const RINGS: Record<Avatar, string> = {
  fox: 'var(--coral-wash)',
  bee: 'var(--sun-wash)',
  owl: 'var(--sky-wash)',
  cat: 'var(--berry-wash)',
  rabbit: 'var(--leaf-wash)',
};

export function AvatarIcon({ avatar, size = 64, ring = true }: { avatar: Avatar; size?: number; ring?: boolean }) {
  const face = FACES[avatar] ?? FACES.fox;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ display: 'block' }}>
      {ring && <circle cx="50" cy="50" r="49" fill={RINGS[avatar] ?? 'var(--sky-wash)'} />}
      <g transform="translate(0 4)">{face(size)}</g>
    </svg>
  );
}
