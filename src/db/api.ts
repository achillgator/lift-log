// The contract between the data layer and the screens. Screens import `api` from src/db and never touch Dexie.
import type {
  Bodyweight, CalendarEntry, Exercise, FinishInput, Habit, HabitLog, ImportMode, ImportPreview,
  LoggedSet, Max, QuickAdd, Routine, Session, Settings, StallStatus, StorageStatus,
} from './types';

export interface LiftLogApi {
  listExercises(includeArchived?: boolean): Promise<Exercise[]>;
  saveExercise(exercise: Exercise): Promise<void>;
  listRoutines(includeArchived?: boolean): Promise<Routine[]>;
  saveRoutine(routine: Routine): Promise<void>;
  routineForDate(date: string): Promise<Routine | undefined>;
  listQuickAdds(): Promise<QuickAdd[]>;
  saveQuickAdd(quickAdd: QuickAdd): Promise<void>;
  deleteQuickAdd(id: string): Promise<void>;

  /** Returns the draft for this date and routine, or creates it with sets pre-filled from the progression rules. */
  startSession(date: string, routineId?: string): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  listSessions(status?: Session['status']): Promise<Session[]>;
  finishSession(id: string, input: FinishInput): Promise<void>;
  updateSession(session: Session): Promise<void>;
  /** Returns a function that restores the session, for Undo. */
  deleteSession(id: string): Promise<() => Promise<void>>;
  applyQuickAdd(sessionId: string, quickAddId: string): Promise<void>;

  listSets(sessionId: string): Promise<LoggedSet[]>;
  /** Done sets for one exercise across all finished sessions, oldest first, with each session's date. */
  setHistory(exerciseId: string): Promise<(LoggedSet & { date: string })[]>;
  saveSet(set: LoggedSet): Promise<void>;
  /** Returns a function that restores the set, for Undo. */
  deleteSet(id: string): Promise<() => Promise<void>>;

  listMaxes(exerciseId?: string): Promise<Max[]>;
  saveMax(max: Max): Promise<void>;
  deleteMax(id: string): Promise<void>;
  listBodyweight(): Promise<Bodyweight[]>;
  /** One entry per date: logging a date again replaces it. */
  logBodyweight(date: string, weightLb: number): Promise<void>;
  deleteBodyweight(date: string): Promise<void>;

  listHabits(includeArchived?: boolean): Promise<Habit[]>;
  saveHabit(habit: Habit): Promise<void>;
  listHabitLogs(fromDate?: string, toDate?: string): Promise<HabitLog[]>;
  setHabitDone(date: string, habitId: string, done: boolean): Promise<void>;
  listCalendar(): Promise<CalendarEntry[]>;
  saveCalendarEntry(entry: CalendarEntry): Promise<void>;
  deleteCalendarEntry(id: string): Promise<void>;

  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  /** Stall rule for one exercise (optionally within one routine): missed reps settings.rules.stallWeeks weeks running. */
  stallStatus(exerciseId: string, routineId?: string): Promise<StallStatus>;

  exportJson(): Promise<Blob>;
  exportCsv(): Promise<Blob>;
  previewImport(file: Blob): Promise<ImportPreview>;
  importJson(file: Blob, mode: ImportMode): Promise<void>;
  exportProgram(): Promise<Blob>;
  previewProgram(file: Blob): Promise<ImportPreview>;
  importProgram(file: Blob, mode: ImportMode): Promise<void>;
  /** Returns a preview without saving: parsed session count plus errors with line numbers. */
  previewPasteLog(text: string): Promise<ImportPreview>;
  savePasteLog(text: string): Promise<void>;

  requestPersistence(): Promise<boolean>;
  storageStatus(): Promise<StorageStatus>;
}
