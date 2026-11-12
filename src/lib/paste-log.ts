// Paste-log parser for old training notes, one workout per line:
//   YYYY-MM-DD exercise NxR@W; exercise R@W, R@W; hang S,S,S
// Exercises: squat, bench, deadlift, curl (saved as "Curl (legacy)"), and hang (dead-hang seconds).
// Within an exercise, comma-separated groups are either NxR@W (N sets of R reps at W lb) or R@W (one set).
// The full-width ＠ and × are accepted too. Blank lines and lines starting with # are ignored.
import type { ExerciseKind } from '../db/types';
import { isValidDate } from './dates';

export const LEGACY_ROUTINE_NAME = 'Legacy 5x5';

export const LEGACY_EXERCISES = {
  squat: { name: 'Squat', kind: 'barbell' },
  bench: { name: 'Bench press', kind: 'barbell' },
  deadlift: { name: 'Deadlift', kind: 'barbell' },
  curl: { name: 'Curl (legacy)', kind: 'dumbbell' },
  hang: { name: 'Dead hang', kind: 'hold' },
} as const satisfies Record<string, { name: string; kind: ExerciseKind }>;

export type LegacyKey = keyof typeof LEGACY_EXERCISES;

export interface ParsedSet { weightLb?: number; reps?: number; holdSec?: number; }
export interface ParsedEntry { key: LegacyKey; sets: ParsedSet[]; }
export interface ParsedWorkout { line: number; date: string; entries: ParsedEntry[]; }
export interface PasteLogResult { workouts: ParsedWorkout[]; errors: string[]; }

const NUM = String.raw`\d+(?:\.\d+)?`;
const GROUP_RE = new RegExp(String.raw`^(?:(\d+)\s*[xX×]\s*)?(\d+)\s*[@＠]\s*(${NUM})$`);
const MAX_SETS = 20;

function parseGroups(key: LegacyKey, body: string): { sets?: ParsedSet[]; error?: string } {
  const groups = body.split(',').map((g) => g.trim());
  if (groups.some((g) => g === '')) return { error: `${key}: empty entry between commas` };
  const sets: ParsedSet[] = [];
  for (const g of groups) {
    if (key === 'hang') {
      if (!/^\d+$/.test(g) || Number(g) === 0) return { error: `hang: "${g}" should be whole seconds, like hang 30,25,20` };
      sets.push({ holdSec: Number(g) });
      continue;
    }
    const m = GROUP_RE.exec(g);
    if (!m) return { error: `${key}: "${g}" should look like 3x5@135 or 5@135` };
    const count = m[1] ? Number(m[1]) : 1;
    const reps = Number(m[2]);
    const weightLb = Number(m[3]);
    if (count < 1 || count > MAX_SETS) return { error: `${key}: "${g}" has ${count} sets (1 to ${MAX_SETS})` };
    if (reps < 1) return { error: `${key}: "${g}" needs at least 1 rep` };
    if (weightLb > 2000) return { error: `${key}: "${g}" weight looks wrong` };
    for (let i = 0; i < count; i++) sets.push({ weightLb, reps });
  }
  return { sets };
}

/** Parses the whole paste. Each malformed line adds one error naming its line number and why. */
export function parsePasteLog(text: string): PasteLogResult {
  const workouts: ParsedWorkout[] = [];
  const errors: string[] = [];
  const known = Object.keys(LEGACY_EXERCISES).join(', ');

  text.split(/\r?\n/).forEach((raw, idx) => {
    const lineNo = idx + 1;
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;
    const fail = (why: string) => errors.push(`Line ${lineNo}: ${why}`);

    const m = /^(\S+)\s+(.*)$/.exec(line);
    if (!m) return fail('expected a date followed by exercises, like 2024-03-04 squat 3x5@135');
    const [, date, rest] = m;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(`"${date}" is not a YYYY-MM-DD date`);
    if (!isValidDate(date)) return fail(`${date} is not a real date`);

    const entries: ParsedEntry[] = [];
    for (const segment of rest.split(';').map((s) => s.trim())) {
      if (segment === '') continue;
      const sm = /^([A-Za-z]+)\s*(.*)$/.exec(segment);
      if (!sm) return fail(`"${segment}" should start with an exercise name (${known})`);
      const key = sm[1].toLowerCase();
      if (!(key in LEGACY_EXERCISES)) return fail(`unknown exercise "${sm[1]}" (use ${known})`);
      if (sm[2].trim() === '') return fail(`${key} has no sets`);
      const parsed = parseGroups(key as LegacyKey, sm[2]);
      if (parsed.error) return fail(parsed.error);
      entries.push({ key: key as LegacyKey, sets: parsed.sets! });
    }
    if (entries.length === 0) return fail('no exercises after the date');
    workouts.push({ line: lineNo, date, entries });
  });

  return { workouts, errors };
}
