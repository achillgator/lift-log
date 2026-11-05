// Habit streaks and editing rules (v1.1). Pure functions; the habits feature saves through `api`.
import type { Habit, HabitLog } from '../../db/types';
import { addDays, compareDates, diffDays } from './dates';
import { nextOrder } from './order';

/** Habits for the first-launch seed (SPEC v1.1). Generic, editable and deletable in the app. */
export const DEFAULT_HABIT_NAMES = ['Mobility', 'Protein target', 'Sleep 8+ h', 'Water'] as const;

export const HABIT_NAME_MAX = 40;

export interface Streak {
  /** Consecutive done days ending today, or ending yesterday while today is still open. */
  current: number;
  best: number;
  doneToday: boolean;
}

/**
 * Streaks for one habit. A day with no log or a `done: false` log breaks the streak.
 * Today not being done yet does not break the current streak until the day is over.
 */
export function habitStreak(logs: HabitLog[], habitId: string, today: string): Streak {
  const days = [...new Set(logs.filter((l) => l.habitId === habitId && l.done && compareDates(l.date, today) <= 0).map((l) => l.date))].sort();
  const done = new Set(days);

  let best = 0;
  let run = 0;
  let prev: string | undefined;
  for (const day of days) {
    run = prev !== undefined && diffDays(prev, day) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }

  const doneToday = done.has(today);
  let current = 0;
  let day = doneToday ? today : addDays(today, -1);
  while (done.has(day)) {
    current++;
    day = addDays(day, -1);
  }
  return { current, best, doneToday };
}

/** Streaks for every habit, keyed by habit id. */
export function habitStreaks(habits: Habit[], logs: HabitLog[], today: string): Record<string, Streak> {
  const out: Record<string, Streak> = {};
  for (const h of habits) out[h.id] = habitStreak(logs, h.id, today);
  return out;
}

/** Trims and checks a habit name. Returns an error message, or undefined when the name is fine. */
export function habitNameError(name: string, habits: Habit[], editingId?: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a name.';
  if (trimmed.length > HABIT_NAME_MAX) return `Keep it under ${HABIT_NAME_MAX + 1} characters.`;
  const clash = habits.find((h) => h.id !== editingId && !h.archived && h.name.trim().toLowerCase() === trimmed.toLowerCase());
  if (clash) return 'A habit with that name already exists.';
  return undefined;
}

/** A new active habit placed after the existing ones. */
export function newHabit(name: string, habits: Habit[], id: string): Habit {
  return { id, name: name.trim(), order: nextOrder(habits), archived: false };
}

/** Active habits in display order. */
export function activeHabits(habits: Habit[]): Habit[] {
  return habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order);
}

/** Archived habits come back at the end of the active list. */
export function unarchiveHabit(habit: Habit, habits: Habit[]): Habit {
  return { ...habit, archived: false, order: nextOrder(activeHabits(habits)) };
}
