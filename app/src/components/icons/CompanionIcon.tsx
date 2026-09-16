import type { FC } from 'react';

// The four zone companions (docs/04-screens-spec.md#world-map), same
// flat-vector kawaii style as Buddy but simpler — secondary characters,
// not the lead.

const FernIcon: FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 200 240" width={size} height={size * 1.2} aria-hidden="true">
    <ellipse cx="100" cy="185" rx="48" ry="44" fill="var(--leaf)" />
    <ellipse cx="100" cy="192" rx="26" ry="24" fill="var(--surface)" />
    <circle cx="100" cy="105" r="48" fill="var(--leaf)" />
    <ellipse cx="78" cy="50" rx="13" ry="42" fill="var(--leaf)" transform="rotate(-8 78 50)" />
    <ellipse cx="78" cy="54" rx="6" ry="30" fill="var(--surface)" transform="rotate(-8 78 54)" />
    <ellipse cx="122" cy="50" rx="13" ry="42" fill="var(--leaf)" transform="rotate(8 122 50)" />
    <ellipse cx="122" cy="54" rx="6" ry="30" fill="var(--surface)" transform="rotate(8 122 54)" />
    <ellipse cx="100" cy="122" rx="30" ry="22" fill="var(--surface)" />
    <circle cx="84" cy="100" r="6.5" fill="var(--ink)" />
    <circle cx="116" cy="100" r="6.5" fill="var(--ink)" />
    <ellipse cx="100" cy="114" rx="5" ry="3.5" fill="var(--berry)" />
  </svg>
);

const BuzzIcon: FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 200 240" width={size} height={size * 1.2} aria-hidden="true">
    <ellipse cx="100" cy="150" rx="40" ry="46" fill="var(--sun)" />
    <rect x="66" y="130" width="68" height="14" fill="var(--ink)" opacity="0.6" />
    <rect x="66" y="155" width="68" height="14" fill="var(--ink)" opacity="0.6" />
    <ellipse cx="55" cy="120" rx="26" ry="16" fill="white" opacity="0.55" transform="rotate(-20 55 120)" />
    <ellipse cx="145" cy="120" rx="26" ry="16" fill="white" opacity="0.55" transform="rotate(20 145 120)" />
    <circle cx="100" cy="90" r="34" fill="var(--sun-dark)" />
    <circle cx="88" cy="86" r="5.5" fill="var(--ink)" />
    <circle cx="112" cy="86" r="5.5" fill="var(--ink)" />
    <path d="M78,62 L68,46 M122,62 L132,46" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
    <circle cx="68" cy="46" r="4" fill="var(--ink)" />
    <circle cx="132" cy="46" r="4" fill="var(--ink)" />
  </svg>
);

const SplashIcon: FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 200 240" width={size} height={size * 1.2} aria-hidden="true">
    <path d="M60,205 Q100,232 140,205" stroke="var(--sky-dark)" strokeWidth="16" fill="none" strokeLinecap="round" />
    <ellipse cx="100" cy="160" rx="46" ry="50" fill="var(--sky)" />
    <ellipse cx="100" cy="168" rx="26" ry="30" fill="var(--surface)" />
    <circle cx="100" cy="100" r="44" fill="var(--sky)" />
    <ellipse cx="100" cy="112" rx="24" ry="18" fill="var(--surface)" />
    <circle cx="84" cy="96" r="6" fill="var(--ink)" />
    <circle cx="116" cy="96" r="6" fill="var(--ink)" />
    <ellipse cx="100" cy="108" rx="5" ry="3.5" fill="var(--ink)" />
  </svg>
);

const NovaIcon: FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 200 240" width={size} height={size * 1.2} aria-hidden="true">
    <circle cx="100" cy="185" r="14" fill="var(--sun)" opacity="0.85" />
    <ellipse cx="70" cy="120" rx="22" ry="30" fill="white" opacity="0.35" transform="rotate(-25 70 120)" />
    <ellipse cx="130" cy="120" rx="22" ry="30" fill="white" opacity="0.35" transform="rotate(25 130 120)" />
    <ellipse cx="100" cy="140" rx="34" ry="40" fill="var(--berry)" />
    <circle cx="100" cy="90" r="30" fill="var(--berry)" />
    <circle cx="90" cy="86" r="5" fill="var(--ink)" />
    <circle cx="110" cy="86" r="5" fill="var(--ink)" />
  </svg>
);

const COMPANIONS: Record<string, FC<{ size: number }>> = {
  fern: FernIcon,
  buzz: BuzzIcon,
  splash: SplashIcon,
  nova: NovaIcon,
};

export function CompanionIcon({ id, size = 72 }: { id: string; size?: number }) {
  const Icon = COMPANIONS[id];
  if (!Icon) return null;
  return <Icon size={size} />;
}

/** Grey silhouette shown for a companion not unlocked yet. */
export function LockedCompanionIcon({ size = 72 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 240" width={size} height={size * 1.2} aria-hidden="true">
      <ellipse cx="100" cy="185" rx="48" ry="44" fill="var(--surface-2)" />
      <circle cx="100" cy="105" r="48" fill="var(--surface-2)" />
      <circle cx="84" cy="100" r="5" fill="var(--sky-wash)" />
      <circle cx="116" cy="100" r="5" fill="var(--sky-wash)" />
    </svg>
  );
}
