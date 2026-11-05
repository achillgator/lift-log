// Shared data model from SPEC.md. All weights are lb; dates are local YYYY-MM-DD; timestamps are epoch ms.
export type ExerciseKind = 'barbell' | 'dumbbell' | 'bodyweight' | 'hold' | 'run' | 'checklist';

export interface Exercise {
  id: string; name: string; kind: ExerciseKind; incrementLb: number; roundToLb: number;
  repMin?: number; repMax?: number; autoIncrease: boolean;
  derivedFrom?: { exerciseId: string; routineId: string; pct: number };
  isMain: boolean; archived: boolean;
}
export interface RoutineItem { exerciseId: string; sets: number; reps: number; repsMax?: number; superset?: 'a' | 'b'; }
export interface Routine {
  id: string; name: string; weekday?: number; order: number; isTest?: boolean;
  distanceProgression?: { startMi: number; stepMi: number; everyWeeks: number; fromDate: string; capMi: number };
  archived: boolean; items: RoutineItem[];
}
export interface QuickAdd {
  id: string; name: string; order: number;
  source: { routineId: string } | { items: RoutineItem[] } | { lines: string[] };
}
export interface Session {
  id: string; date: string; routineId?: string; status: 'draft' | 'done';
  startedAt: number; endedAt?: number; durationMin?: number; calories?: number;
  effort?: number; painFlag: boolean; note: string;
}
export interface LoggedSet {
  id: string; sessionId: string; exerciseId: string; order: number; setNo: number;
  targetWeightLb?: number; targetReps?: number; weightLb?: number; reps?: number;
  strictReps?: number; band?: string; holdSec?: number; distanceM?: number; timeSec?: number;
  done: boolean; skipped: boolean;
}
export interface Max { id: string; exerciseId: string; date: string; weightLb: number; tested: boolean; }
export interface Bodyweight { id: string; date: string; weightLb: number; }
export interface Habit { id: string; name: string; order: number; archived: boolean; }
export interface HabitLog { date: string; habitId: string; done: boolean; }
export interface CalendarEntry {
  id: string; type: 'phase' | 'test' | 'deload' | 'swap'; name: string; startDate: string; endDate?: string;
  routineId?: string; pct?: number; fewerSets?: number; everyWeeks?: number;
}
export interface Photo { id: string; date: string; pose: 'front' | 'side' | 'back'; image: Blob; thumb: Blob; }
export type TrophyTiers = Record<string, [number, number, number, number, number]>;
export interface Settings {
  autoIncreaseGlobal: boolean;
  rules: { stallWeeks: number; deloadPct: number; maxEffort: number };
  trophyTiers: TrophyTiers; platesOwned: number[]; lastExportAt?: number; unit: 'lb';
}
export interface FinishInput { durationMin: number; calories?: number; effort?: number; painFlag?: boolean; note?: string; }
export type ImportMode = 'merge' | 'replace';
export interface ImportPreview { valid: boolean; errors: string[]; counts: Record<string, number>; }
export interface StorageStatus { persisted: boolean; usageBytes?: number; quotaBytes?: number; }
