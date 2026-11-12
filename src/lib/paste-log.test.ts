import { describe, expect, test } from 'vitest';
import { parsePasteLog } from './paste-log';

// Made-up sample lines.
describe('paste-log parser', () => {
  test('parses NxR@W, R@W lists and hang seconds', () => {
    const { workouts, errors } = parsePasteLog('2023-04-03 squat 3x5@95; bench 5@65, 5@65, 4@65; hang 30,25,20');
    expect(errors).toEqual([]);
    expect(workouts).toHaveLength(1);
    const [w] = workouts;
    expect(w).toMatchObject({ line: 1, date: '2023-04-03' });
    expect(w.entries.map((e) => e.key)).toEqual(['squat', 'bench', 'hang']);
    expect(w.entries[0].sets).toEqual(Array(3).fill({ weightLb: 95, reps: 5 }));
    expect(w.entries[1].sets.map((s) => s.reps)).toEqual([5, 5, 4]);
    expect(w.entries[2].sets).toEqual([{ holdSec: 30 }, { holdSec: 25 }, { holdSec: 20 }]);
  });

  test('accepts the full-width ＠ and ×, mixed groups, decimals, case and spacing', () => {
    const { workouts, errors } = parsePasteLog('2023-04-05  Deadlift 1x5＠135 ;CURL 2×10@22.5, 8@22.5;');
    expect(errors).toEqual([]);
    expect(workouts[0].entries[0].sets).toEqual([{ weightLb: 135, reps: 5 }]);
    expect(workouts[0].entries[1]).toEqual({ key: 'curl', sets: [{ weightLb: 22.5, reps: 10 }, { weightLb: 22.5, reps: 10 }, { weightLb: 22.5, reps: 8 }] });
  });

  test('skips blank lines and # comments, keeps real line numbers', () => {
    const text = '# old notes\n\n2023-04-03 squat 5@95\n   \n2023-04-05 bench 5@65';
    const { workouts, errors } = parsePasteLog(text);
    expect(errors).toEqual([]);
    expect(workouts.map((w) => w.line)).toEqual([3, 5]);
  });

  test('reports each malformed line with its number and why', () => {
    const text = [
      '2023-04-03 squat 3x5@95',
      '04/05/2023 squat 3x5@95',
      '2023-02-30 squat 3x5@95',
      '2023-04-07 press 3x5@60',
      '2023-04-08 squat 3x5',
      '2023-04-09 hang 30s',
      '2023-04-10',
      '2023-04-11 bench',
      '2023-04-12 squat 5@95,,5@95',
      '2023-04-13 squat 0x5@95',
    ].join('\n');
    const { workouts, errors } = parsePasteLog(text);
    expect(workouts).toHaveLength(1);
    expect(errors).toHaveLength(9);
    expect(errors[0]).toMatch(/^Line 2: "04\/05\/2023" is not a YYYY-MM-DD date/);
    expect(errors[1]).toMatch(/^Line 3: 2023-02-30 is not a real date/);
    expect(errors[2]).toMatch(/^Line 4: unknown exercise "press" \(use squat, bench, deadlift, curl, hang\)/);
    expect(errors[3]).toMatch(/^Line 5: squat: "3x5" should look like 3x5@135 or 5@135/);
    expect(errors[4]).toMatch(/^Line 6: hang: "30s" should be whole seconds/);
    expect(errors[5]).toMatch(/^Line 7: /);
    expect(errors[6]).toMatch(/^Line 8: bench has no sets/);
    expect(errors[7]).toMatch(/^Line 9: squat: empty entry between commas/);
    expect(errors[8]).toMatch(/^Line 10: squat: "0x5@95" has 0 sets/);
  });

  test('handles Windows line endings', () => {
    expect(parsePasteLog('2023-04-03 squat 5@95\r\n2023-04-04 bench 5@65\r\n').workouts).toHaveLength(2);
  });
});
