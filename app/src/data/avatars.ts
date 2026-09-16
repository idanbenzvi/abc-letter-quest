import type { Avatar } from '../types';

/** Shared between Onboarding (picking one) and PlayerSelect (showing existing players' own colors) — keep the two in sync from one place. */
export const AVATARS: { id: Avatar; color: string }[] = [
  { id: 'fox', color: 'var(--coral)' },
  { id: 'bee', color: 'var(--sun)' },
  { id: 'owl', color: 'var(--sky)' },
  { id: 'cat', color: 'var(--berry)' },
  { id: 'rabbit', color: 'var(--leaf)' },
];

export function avatarColor(avatar: Avatar): string {
  return AVATARS.find((a) => a.id === avatar)?.color ?? 'var(--sky)';
}

/** Display names for the avatar picker and screen readers — kept with the avatar list so the two can't drift apart. */
export const AVATAR_LABELS: Record<Avatar, string> = {
  fox: 'Fox',
  bee: 'Bee',
  owl: 'Owl',
  cat: 'Cat',
  rabbit: 'Rabbit',
};
