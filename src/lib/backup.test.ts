import { describe, expect, test } from 'vitest';
import { backupFileName, parseBackup, programFileName, setsToCsv } from './backup';

const minimal = (data: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ kind: 'lift-log-backup', schemaVersion: 1, exportedAt: 1, data, ...extra });

describe('backup file validation', () => {
  test('accepts a minimal file and fills missing tables with empty lists', () => {
    const { file, errors } = parseBackup(minimal(), 1);
    expect(errors).toEqual([]);
    expect(file?.data.sessions).toEqual([]);
  });

  test('rejects non-JSON, other kinds and newer schema versions', () => {
    expect(parseBackup('{oops', 1).errors).toEqual(['Not a valid JSON file']);
    expect(parseBackup(JSON.stringify({ kind: 'something-else' }), 1).errors).toEqual(['Not a Lift Log backup file']);
    expect(parseBackup(minimal({}, { schemaVersion: 2 }), 1).errors[0]).toMatch(/newer version/);
  });

  test('reports bad rows, unknown kinds, dangling sets and duplicate bodyweight dates', () => {
    const { errors } = parseBackup(minimal({
      exercises: [{ id: 'e', name: 'X', kind: 'kettlebell', incrementLb: 5, roundToLb: 5, autoIncrease: true, isMain: false, archived: false }],
      sessions: [{ id: 's', date: '2024-01-01', status: 'done', startedAt: 1, painFlag: false, note: '' }],
      sets: [{ id: 't', sessionId: 'missing', exerciseId: 'e', order: 0, setNo: 1, done: true, skipped: false }],
      bodyweight: [{ id: 'a', date: '2024-01-01', weightLb: 150 }, { id: 'b', date: '2024-01-01', weightLb: 151 }],
    }), 1);
    expect(errors).toEqual(expect.arrayContaining([
      'exercises #1: unknown kind "kettlebell"',
      'sets #1: session missing is not in the file',
      'bodyweight: two entries for 2024-01-01',
    ]));

    const shape = parseBackup(minimal({ sessions: [{ id: 's', date: 'Jan 1', status: 'done', startedAt: 1, painFlag: false }] }), 1);
    expect(shape.errors).toEqual(['sessions #1: date should be a YYYY-MM-DD date', 'sessions #1: missing note']);
  });
});

describe('CSV', () => {
  test('one row per set, sorted, with quoting', () => {
    const session = { id: 's', date: '2024-01-02', status: 'done' as const, startedAt: 1, painFlag: false, note: '' };
    const early = { ...session, id: 'r', date: '2024-01-01' };
    const set = (id: string, sessionId: string, setNo: number) => ({ id, sessionId, exerciseId: 'e', order: 0, setNo, weightLb: 100, reps: 5, done: true, skipped: false });
    const csv = setsToCsv([
      { session, set: set('b', 's', 2), exerciseName: 'Lift, "A"', routineName: 'R' },
      { session, set: set('a', 's', 1), exerciseName: 'Lift, "A"', routineName: 'R' },
      { session: early, set: set('c', 'r', 1), exerciseName: 'Other', routineName: '' },
    ]);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('date,routine,exercise,sessionStatus,setNo,targetWeightLb,targetReps,weightLb,reps,strictReps,band,holdSec,distanceM,timeSec,done,skipped');
    expect(lines[1]).toBe('2024-01-01,,Other,done,1,,,100,5,,,,,,true,false');
    expect(lines[2]).toBe('2024-01-02,R,"Lift, ""A""",done,1,,,100,5,,,,,,true,false');
    expect(lines[3].startsWith('2024-01-02,R,"Lift, ""A""",done,2,')).toBe(true);
  });
});

test('export file names match the .gitignore patterns', () => {
  expect(backupFileName('json', '2024-05-06')).toBe('lift-log-backup-2024-05-06.json');
  expect(backupFileName('csv', '2024-05-06')).toBe('lift-log-backup-2024-05-06.csv');
  expect(programFileName('2024-05-06')).toMatch(/^lift-log-backup/);
});
