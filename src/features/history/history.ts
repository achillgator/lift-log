// Pure rules for History: finished workouts newest first, grouped by month.
import type { Session } from '../../db/types';
import { parseDate } from '../../components/format';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function newestFirst(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt);
}

export function byMonth(sessions: Session[]): { month: string; sessions: Session[] }[] {
  const out: { month: string; sessions: Session[] }[] = [];
  for (const s of newestFirst(sessions)) {
    const d = parseDate(s.date);
    const month = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    const last = out[out.length - 1];
    if (last?.month === month) last.sessions.push(s);
    else out.push({ month, sessions: [s] });
  }
  return out;
}

/** "45 min · Effort 7 · Pain" */
export function sessionDetail(s: Session): string {
  const parts: string[] = [];
  if (s.durationMin) parts.push(`${s.durationMin} min`);
  if (s.calories) parts.push(`${s.calories} cal`);
  if (s.effort) parts.push(`Effort ${s.effort}`);
  if (s.painFlag) parts.push('Pain flagged');
  return parts.join(' · ');
}
