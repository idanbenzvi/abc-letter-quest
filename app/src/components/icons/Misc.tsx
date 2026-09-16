export function SpeakerIcon({ color = 'white', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4,10 L4,14 L9,14 L15,19 L15,5 L9,10 Z" fill={color} />
      <path d="M18,9 A5,5 0 0,1 18,15 M20.5,6.5 A9,9 0 0,1 20.5,17.5" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function KeyboardIcon({ color = 'var(--ink-soft)', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="13" rx="2.5" fill="none" stroke={color} strokeWidth="1.6" />
      <rect x="5.5" y="9" width="2.4" height="2.4" rx="0.6" fill={color} />
      <rect x="10.8" y="9" width="2.4" height="2.4" rx="0.6" fill={color} />
      <rect x="16.1" y="9" width="2.4" height="2.4" rx="0.6" fill={color} />
      <rect x="7" y="14" width="10" height="2.2" rx="1.1" fill={color} />
    </svg>
  );
}

export function SparkleIcon({ color = 'var(--sun-dark)', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12,4 L13.4,10.6 L20,12 L13.4,13.4 L12,20 L10.6,13.4 L4,12 L10.6,10.6 Z" fill={color} />
    </svg>
  );
}

export function MysteryIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="var(--sky-dark)" strokeWidth="1.6" strokeDasharray="2.2 4" opacity="0.65" />
      <path d="M12,7.2 L13.1,10.9 L16.8,12 L13.1,13.1 L12,16.8 L10.9,13.1 L7.2,12 L10.9,10.9 Z" fill="var(--sun-dark)" />
    </svg>
  );
}

export function CheckIcon({ color = 'white', size = 14 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
      <path d="M4,10 L8,14 L16,5" stroke={color} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SwapCaseIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4,8 L15,8 M15,8 L11,4 M15,8 L11,12" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20,16 L9,16 M9,16 L13,20 M9,16 L13,12" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MicIcon({ color = 'white', size = 28 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" fill={color} />
      <path d="M6,11 A6,6 0 0,0 18,11 M12,17 L12,21 M8,21 L16,21" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowLeftIcon({ color = 'white', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M15,5 L8,12 L15,19" stroke={color} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRightIcon({ color = 'white', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M9,5 L16,12 L9,19" stroke={color} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GearIcon({ color = 'var(--ink-soft)', size = 20 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="3" fill="none" stroke={color} strokeWidth="1.8" />
      <path
        d="M12,3 L12,6 M12,18 L12,21 M3,12 L6,12 M18,12 L21,12 M5.6,5.6 L7.7,7.7 M16.3,16.3 L18.4,18.4 M5.6,18.4 L7.7,16.3 M16.3,7.7 L18.4,5.6"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CloseIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M6,6 L18,18 M18,6 L6,18" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function BookIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12,6 C10,4.5 6.5,4 4,4.5 L4,18.5 C6.5,18 10,18.5 12,20 C14,18.5 17.5,18 20,18.5 L20,4.5 C17.5,4 14,4.5 12,6 Z" fill="none" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12,6 L12,20" stroke={color} strokeWidth="1.7" />
    </svg>
  );
}

export function InfoIcon({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke={color} strokeWidth="1.8" />
      <circle cx="12" cy="7.6" r="1.15" fill={color} />
      <path d="M12,11 L12,17" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function FlameIcon({ color = 'var(--coral-dark)', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12,2.5 C12,7 8,8 8,12.5 C8,16.5 10.5,18.5 12,20.5 C13.5,18.5 16,16.5 16,12.5 C16,10.5 14.7,9.7 14.2,11.2 C14,11.8 13.3,11.6 13.3,10.8 C13.3,8.3 12,6.5 12,2.5 Z"
        fill={color}
      />
      <path d="M12,13.5 C12,15.5 10.8,16.3 10.8,17.8 C10.8,19.1 11.3,19.9 12,20.5 C12.7,19.9 13.2,19.1 13.2,17.8 C13.2,16.3 12,15.5 12,13.5 Z" fill="var(--sun, #f6c667)" opacity="0.85" />
    </svg>
  );
}

export function StarIcon({ color = 'var(--sun-dark)', size = 16 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <polygon points="12,2 15,9 22,10 17,15 18,22 12,18 6,22 7,15 2,10 9,9" fill={color} />
    </svg>
  );
}

export function PauseIcon({ color = 'var(--ink)', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="6" y="4" width="4.5" height="16" rx="2" fill={color} />
      <rect x="13.5" y="4" width="4.5" height="16" rx="2" fill={color} />
    </svg>
  );
}

export function PlayIcon({ color = 'white', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M8,5 L19,12 L8,19 Z" fill={color} strokeLinejoin="round" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export function NestIcon({ color = 'currentColor', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4,13 Q12,9 20,13 L19,17 Q12,20 5,17 Z" fill={color} />
      <circle cx="9.5" cy="11.5" r="2.4" fill={color} opacity="0.55" />
      <circle cx="14.5" cy="11" r="2.4" fill={color} opacity="0.55" />
    </svg>
  );
}

export function SoundOnIcon({ color = 'currentColor', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4,10 L4,14 L8,14 L13,18 L13,6 L8,10 Z" fill={color} />
      <path d="M16,9 A4,4 0 0,1 16,15 M18.5,6.5 A8,8 0 0,1 18.5,17.5" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function SoundOffIcon({ color = 'currentColor', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4,10 L4,14 L8,14 L13,18 L13,6 L8,10 Z" fill={color} />
      <path d="M16.5,9.5 L21,14.5 M21,9.5 L16.5,14.5" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronLeftIcon({ color = 'currentColor', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M14.5,6 L8.5,12 L14.5,18" stroke={color} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRightIcon({ color = 'currentColor', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M9.5,6 L15.5,12 L9.5,18" stroke={color} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HandTapIcon({ color = 'currentColor', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M9,12 L9,5.5 A1.5,1.5 0 0,1 12,5.5 L12,11 L16.5,12.5 A2,2 0 0,1 18,14.5 L17,19 A2,2 0 0,1 15,20.5 L10.5,20.5 A3,3 0 0,1 8,19 L5.5,15 A1.4,1.4 0 0,1 7.8,13.5 Z" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M6.5,6.5 A4.5,4.5 0 0,1 14.5,6.5" stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function TraceIcon({ color = 'currentColor', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M4,17 C7,9 10,9 12,13 C14,17 17,17 20,9" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeDasharray="1 3.4" />
      <circle cx="20" cy="9" r="2.2" fill={color} />
    </svg>
  );
}

export function PictureIcon({ color = 'currentColor', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke={color} strokeWidth="1.8" />
      <circle cx="8.5" cy="10" r="1.8" fill={color} />
      <path d="M5,17 L10,12.5 L13.5,15.5 L16,13.5 L19,17" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GrownUpIcon({ color = 'currentColor', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill="none" stroke={color} strokeWidth="1.9" />
      <path d="M4.5,20 C5.5,15.5 8.5,14 12,14 C15.5,14 18.5,15.5 19.5,20" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function CloudIcon({ color = 'currentColor', size = 18 }: { color?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M7,18 A4,4 0 0,1 6.5,10 A5.5,5.5 0 0,1 17,9 A3.8,3.8 0 0,1 17.5,18 Z" fill={color} />
    </svg>
  );
}
