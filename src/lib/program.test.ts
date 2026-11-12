import { describe, expect, test } from 'vitest';
import { buildProgram, parseProgram, programCounts } from './program';
import { buildSeed } from '../db/seed';
import spec from '../../SPEC.md?raw';

/** The made-up example in SPEC.md, so the documentation can never drift from the validator. */
function specExample(): string {
  const section = spec.slice(spec.indexOf('### Program file format'));
  const m = /```json\n([\s\S]*?)\n```/.exec(section);
  if (!m) throw new Error('No JSON example under "Program file format" in SPEC.md');
  return m[1];
}

describe('program file', () => {
  test('the SPEC.md example is valid', () => {
    const { file, errors } = parseProgram(specExample());
    expect(errors).toEqual([]);
    expect(programCounts(file!)).toEqual({ exercises: 5, routines: 3, quickAdds: 2, habits: 1, calendar: 1 });
  });

  test('rejects other kinds, versions and logged data', () => {
    expect(parseProgram('nope').errors).toEqual(['Not a valid JSON file']);
    expect(parseProgram(JSON.stringify({ kind: 'lift-log-backup' })).errors).toEqual(['Not a Lift Log program file']);
    expect(parseProgram(JSON.stringify({ kind: 'lift-log-program', version: 2 })).errors[0]).toMatch(/Unsupported/);
    const withSessions = { ...JSON.parse(specExample()), sessions: [], bodyweight: [] };
    expect(parseProgram(JSON.stringify(withSessions)).errors).toEqual([
      "A program file can't hold sessions; use a backup file for logged data",
      "A program file can't hold bodyweight; use a backup file for logged data",
    ]);
  });

  test('every reference must point inside the file', () => {
    const p = JSON.parse(specExample());
    p.exercises = p.exercises.filter((e: { id: string }) => e.id !== 'ex-press');
    p.quickAdds[1].source.routineId = 'rt-gone';
    const { errors } = parseProgram(JSON.stringify(p));
    expect(errors).toEqual(expect.arrayContaining([
      'Light press (derived): exercise ex-press is not in the file',
      'Routine Day A: exercise ex-press is not in the file',
      'Quick-add Day B: routine rt-gone is not in the file',
      'settings.trophyTiers: exercise ex-press is not in the file',
    ]));
  });

  test('bad shapes are reported per row', () => {
    const p = JSON.parse(specExample());
    p.exercises[0].kind = 'machine';
    p.routines[0].items[0] = { exerciseId: 'ex-goblet' };
    p.calendar[0].startDate = 'March';
    p.settings.rules = { stallWeeks: 'two' };
    expect(parseProgram(JSON.stringify(p)).errors).toEqual(expect.arrayContaining([
      'calendar #1: startDate should be a YYYY-MM-DD date',
      'settings.rules.stallWeeks should be a number',
    ]));
    p.calendar[0].startDate = '2030-03-04';
    p.settings.rules = { stallWeeks: 2, deloadPct: 10, maxEffort: 8 };
    expect(parseProgram(JSON.stringify(p)).errors).toEqual(expect.arrayContaining([
      'exercises #1: unknown kind "machine"',
      'routines #1 item 1: needs exerciseId, sets and reps',
    ]));
  });

  test('buildProgram exports active rows plus whatever they reference, and round-trips', () => {
    const seed = buildSeed();
    const archivedLift = { ...seed.exercises[1], archived: true };
    const exercises = [seed.exercises[0], archivedLift, ...seed.exercises.slice(2)];
    const routines = [{ ...seed.routines[0], items: [...seed.routines[0].items, { exerciseId: archivedLift.id, sets: 1, reps: 3 }] },
      { id: 'old', name: 'Old', order: 1, archived: true, items: [] }];
    const p = buildProgram({ exercises, routines, quickAdds: seed.quickAdds, habits: [], calendar: [], settings: seed.settings }, 5);
    expect(p.routines.map((r) => r.id)).toEqual([seed.routines[0].id]);
    expect(p.exercises.map((e) => e.id)).toContain(archivedLift.id);
    expect(Object.keys(p.settings!.trophyTiers!)).toHaveLength(4);
    expect(Object.keys(p)).not.toContain('sessions');
    expect(Object.keys(p)).not.toContain('bodyweight');
    expect(parseProgram(JSON.stringify(p)).errors).toEqual([]);
  });
});
