// Pure rules for the Home screen.
import type { Routine, Session } from '../../db/types';
import { parseDate, weekOf } from '../../components/format';

export const BACKUP_AFTER_DAYS = 7;
const DAY_MS = 86_400_000;

/**
 * Backup banner: the last export is over 7 days old. Someone who never exported sees it once
 * they have finished a workout (an empty app has nothing to back up).
 */
export function needsBackup(lastExportAt: number | undefined, hasFinishedWorkout: boolean, now = Date.now()): boolean {
  if (lastExportAt === undefined) return hasFinishedWorkout;
  return now - lastExportAt > BACKUP_AFTER_DAYS * DAY_MS;
}

export function daysSince(ts: number, now = Date.now()): number {
  return Math.floor((now - ts) / DAY_MS);
}

export interface StripDay {
  date: string;
  letter: string;
  day: number;
  isToday: boolean;
  done: boolean;
  planned: boolean;
}

/** Sunday-to-Saturday strip for the current week: which days have a finished workout or a routine. */
export function weekStrip(today: string, sessions: Pick<Session, 'date' | 'status'>[], routines: Pick<Routine, 'weekday' | 'archived'>[]): StripDay[] {
  const doneDates = new Set(sessions.filter((s) => s.status === 'done').map((s) => s.date));
  const plannedDays = new Set(routines.filter((r) => !r.archived && r.weekday !== undefined).map((r) => r.weekday));
  return weekOf(today).map((date, i) => ({
    date,
    letter: 'SMTWTFS'[i],
    day: parseDate(date).getDate(),
    isToday: date === today,
    done: doneDates.has(date),
    planned: plannedDays.has(i),
  }));
}
