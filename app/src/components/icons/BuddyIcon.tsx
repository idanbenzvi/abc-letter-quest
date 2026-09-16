// Buddy the fox, hand-built inline SVG — see docs/03-design-system.md.
// Two poses for now; more (jumping, curious, sleepy, pointing) are the
// AI-art pipeline's job per docs/08-asset-pipeline.md, not hand-authored
// here.
type Pose = 'wave' | 'cheer';

export function BuddyIcon({ pose = 'wave', size = 96 }: { pose?: Pose; size?: number }) {
  return (
    <svg viewBox="0 0 200 240" width={size} height={size * 1.2} aria-hidden="true">
      {pose === 'wave' ? (
        <>
          <path d="M150,190 Q180,175 172,140" stroke="var(--coral)" strokeWidth="20" strokeLinecap="round" fill="none" />
          <path d="M50,175 Q22,165 28,130" stroke="var(--coral)" strokeWidth="20" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M40,180 Q10,120 40,80" stroke="var(--coral)" strokeWidth="20" strokeLinecap="round" fill="none" />
          <path d="M160,180 Q190,120 160,80" stroke="var(--coral)" strokeWidth="20" strokeLinecap="round" fill="none" />
        </>
      )}
      <ellipse cx="100" cy="185" rx="52" ry="48" fill="var(--coral)" />
      <ellipse cx="100" cy="196" rx="28" ry="26" fill="var(--surface)" />
      <circle cx="100" cy="95" r="56" fill="var(--coral)" />
      <polygon points="56,58 42,8 82,50" fill="var(--coral)" />
      <polygon points="60,48 53,25 74,47" fill="var(--surface)" />
      <polygon points="144,58 158,8 118,50" fill="var(--coral)" />
      <polygon points="140,48 147,25 126,47" fill="var(--surface)" />
      <ellipse cx="100" cy="115" rx="36" ry="26" fill="var(--surface)" />
      <circle cx="70" cy="112" r="7" fill="var(--berry)" opacity="0.35" />
      <circle cx="130" cy="112" r="7" fill="var(--berry)" opacity="0.35" />
      <circle cx="81" cy="90" r="7" fill="var(--ink)" />
      <circle cx="119" cy="90" r="7" fill="var(--ink)" />
      <ellipse cx="100" cy="106" rx="5.5" ry="3.6" fill="var(--ink-soft)" />
      {pose === 'wave' ? (
        <path d="M89,119 Q100,126 111,119" stroke="var(--ink)" strokeWidth="2.3" fill="none" strokeLinecap="round" />
      ) : (
        <ellipse cx="100" cy="122" rx="10" ry="7" fill="var(--ink)" />
      )}
    </svg>
  );
}
