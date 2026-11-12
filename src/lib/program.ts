// Program file: the plan without the history (see "Program file format" in SPEC.md).
import type { CalendarEntry, Exercise, Habit, QuickAdd, Routine, Settings } from '../db/types';
import { ROW_SPECS, checkDomain } from './backup';
import { checkRows, checkUniqueIds, isObject, parseJson, push } from './validate';

export const PROGRAM_KIND = 'lift-log-program';
export const PROGRAM_VERSION = 1;

export type ProgramSettings = Partial<Pick<Settings, 'autoIncreaseGlobal' | 'rules' | 'trophyTiers'>>;

export interface ProgramFile {
  kind: typeof PROGRAM_KIND; version: number; exportedAt?: number;
  exercises: Exercise[]; routines: Routine[]; quickAdds: QuickAdd[]; habits: Habit[]; calendar: CalendarEntry[];
  settings?: ProgramSettings;
}

const PROGRAM_TABLES = ['exercises', 'routines', 'quickAdds', 'habits', 'calendar'] as const;
const FORBIDDEN = ['sessions', 'sets', 'maxes', 'bodyweight', 'photos', 'habitLogs'];

/**
 * Builds a program from the current data: active routines, the exercises they (or the quick-adds) use plus
 * all active exercises, quick-adds, active habits, calendar rows and the settings rules.
 */
export function buildProgram(
  all: { exercises: Exercise[]; routines: Routine[]; quickAdds: QuickAdd[]; habits: Habit[]; calendar: CalendarEntry[]; settings: Settings },
  exportedAt: number,
): ProgramFile {
  const routineIds = new Set(all.routines.filter((r) => !r.archived).map((r) => r.id));
  for (const q of all.quickAdds) if ('routineId' in q.source) routineIds.add(q.source.routineId);
  for (const c of all.calendar) if (c.routineId) routineIds.add(c.routineId);
  const routines = all.routines.filter((r) => routineIds.has(r.id));

  const exerciseIds = new Set(all.exercises.filter((e) => !e.archived).map((e) => e.id));
  for (const r of routines) for (const i of r.items) exerciseIds.add(i.exerciseId);
  for (const q of all.quickAdds) if ('items' in q.source) for (const i of q.source.items) exerciseIds.add(i.exerciseId);
  // Derived sources (and their routines) must travel with the lift that follows them.
  for (const e of all.exercises) {
    if (exerciseIds.has(e.id) && e.derivedFrom) {
      exerciseIds.add(e.derivedFrom.exerciseId);
      if (!routineIds.has(e.derivedFrom.routineId)) {
        const src = all.routines.find((r) => r.id === e.derivedFrom!.routineId);
        if (src) { routines.push(src); routineIds.add(src.id); }
      }
    }
  }
  const exercises = all.exercises.filter((e) => exerciseIds.has(e.id));
  const trophyTiers = Object.fromEntries(Object.entries(all.settings.trophyTiers).filter(([id]) => exerciseIds.has(id)));

  return {
    kind: PROGRAM_KIND, version: PROGRAM_VERSION, exportedAt,
    exercises, routines, quickAdds: all.quickAdds, habits: all.habits.filter((h) => !h.archived), calendar: all.calendar,
    settings: { autoIncreaseGlobal: all.settings.autoIncreaseGlobal, rules: all.settings.rules, trophyTiers },
  };
}

export function programCounts(p: Partial<ProgramFile>): Record<string, number> {
  return Object.fromEntries(PROGRAM_TABLES.map((t) => [t, p[t]?.length ?? 0]));
}

/** Parses and validates a program file. Every reference must point at a row inside the same file. */
export function parseProgram(text: string): { file?: ProgramFile; errors: string[] } {
  const errors: string[] = [];
  const { value, error } = parseJson(text);
  if (error) return { errors: [error] };
  if (!isObject(value) || value.kind !== PROGRAM_KIND) return { errors: ['Not a Lift Log program file'] };
  if (value.version !== PROGRAM_VERSION) return { errors: [`Unsupported program file version ${String(value.version)}`] };
  for (const t of FORBIDDEN) {
    if (value[t] !== undefined) push(errors, `A program file can't hold ${t}; use a backup file for logged data`);
  }
  for (const t of PROGRAM_TABLES) {
    if (value[t] === undefined) value[t] = [];
    checkRows(t, value[t], ROW_SPECS[t], errors);
  }
  if (value.settings !== undefined) {
    const s = value.settings;
    if (!isObject(s)) push(errors, 'settings: expected an object');
    else {
      if (s.autoIncreaseGlobal !== undefined && typeof s.autoIncreaseGlobal !== 'boolean') push(errors, 'settings.autoIncreaseGlobal should be true or false');
      if (s.rules !== undefined) {
        if (!isObject(s.rules)) push(errors, 'settings.rules: expected an object');
        else for (const k of ['stallWeeks', 'deloadPct', 'maxEffort']) {
          if (typeof s.rules[k] !== 'number') push(errors, `settings.rules.${k} should be a number`);
        }
      }
      if (s.trophyTiers !== undefined && !isObject(s.trophyTiers)) push(errors, 'settings.trophyTiers: expected an object');
    }
  }
  if (errors.length) return { errors };

  const p = value as unknown as ProgramFile;
  checkDomain(p, errors);
  for (const t of PROGRAM_TABLES) checkUniqueIds(t, p[t], errors);
  if (errors.length) return { errors };

  const exerciseIds = new Set(p.exercises.map((e) => e.id));
  const routineIds = new Set(p.routines.map((r) => r.id));
  const needExercise = (where: string, id: string) => {
    if (!exerciseIds.has(id)) push(errors, `${where}: exercise ${id} is not in the file`);
  };
  const needRoutine = (where: string, id: string) => {
    if (!routineIds.has(id)) push(errors, `${where}: routine ${id} is not in the file`);
  };
  p.exercises.forEach((e) => {
    if (e.derivedFrom) {
      needExercise(`${e.name} (derived)`, e.derivedFrom.exerciseId);
      needRoutine(`${e.name} (derived)`, e.derivedFrom.routineId);
    }
  });
  p.routines.forEach((r) => r.items.forEach((i) => needExercise(`Routine ${r.name}`, i.exerciseId)));
  p.quickAdds.forEach((q) => {
    const src = q.source as Record<string, unknown>;
    if (typeof src.routineId === 'string') needRoutine(`Quick-add ${q.name}`, src.routineId);
    else if (Array.isArray(src.items)) {
      for (const i of src.items) {
        if (!isObject(i) || typeof i.exerciseId !== 'string') push(errors, `Quick-add ${q.name}: item needs an exerciseId`);
        else needExercise(`Quick-add ${q.name}`, i.exerciseId);
      }
    } else if (!Array.isArray(src.lines) || !src.lines.every((l) => typeof l === 'string')) {
      push(errors, `Quick-add ${q.name}: source needs routineId, items or lines`);
    }
  });
  p.calendar.forEach((c) => {
    if (!['phase', 'test', 'deload', 'swap'].includes(c.type)) push(errors, `Calendar ${c.name}: unknown type "${c.type}"`);
    if (c.routineId) needRoutine(`Calendar ${c.name}`, c.routineId);
  });
  if (p.settings?.trophyTiers) {
    for (const [id, tiers] of Object.entries(p.settings.trophyTiers)) {
      needExercise('settings.trophyTiers', id);
      if (!Array.isArray(tiers) || tiers.length !== 5 || !tiers.every((t) => typeof t === 'number')) {
        push(errors, `settings.trophyTiers: ${id} needs five numbers`);
      }
    }
  }
  if (errors.length) return { errors };
  return { file: p, errors };
}
