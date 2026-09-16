import type { SessionSummary } from '../types';

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Consecutive calendar days (ending today or yesterday) with >=1 session. */
export function computeStreak(sessions: SessionSummary[], now = new Date()): number {
  const days = new Set(sessions.map((s) => s.date));
  let streak = 0;
  const cursor = new Date(now);
  // If nothing happened today yet, a streak can still be "alive" through yesterday.
  if (!days.has(toDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Real elapsed minutes across sessions in the last 7 days — never estimated. */
export function weeklyMinutes(sessions: SessionSummary[], now = new Date()): number {
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recent = sessions.filter((s) => new Date(s.startedAt) >= weekAgo);
  const ms = recent.reduce((sum, s) => sum + (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()), 0);
  return Math.round(ms / 60000);
}

/** Last 7 calendar days (oldest first), with whether each had a session. */
export function last7Days(sessions: SessionSummary[], now = new Date()): { date: string; label: string; practiced: boolean }[] {
  const days = new Set(sessions.map((s) => s.date));
  const out: { date: string; label: string; practiced: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = toDateKey(d);
    out.push({ date: key, label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), practiced: days.has(key) });
  }
  return out;
}
