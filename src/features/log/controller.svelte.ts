// State and actions for one Log sheet. Every change updates the screen first (a check shows at
// once), then writes to IndexedDB through the api; nothing waits for a Finish button.
import type { LiftLogApi } from '../../db/api';
import type { Exercise, ExerciseKind, LoggedSet, QuickAdd, Routine, Session } from '../../db/types';
import { errorMessage } from '../../components/format';
import { firstSet, groupByExercise, setAfter, sortSets, swapExercise, tapExercise } from './logic';

export interface Notifier {
  show(message: string, opts?: { undo?: () => unknown }): void;
  error(what: string, err: unknown): void;
}

export class LogController {
  session = $state<Session | undefined>();
  sets = $state<LoggedSet[]>([]);
  exercises = $state<Exercise[]>([]);
  routines = $state<Routine[]>([]);
  quickAdds = $state<QuickAdd[]>([]);
  loadError = $state<string | undefined>();
  loaded = $state(false);
  groups = $derived(groupByExercise(this.sets));

  #api: LiftLogApi;
  #notify: Notifier;
  #id: string;

  constructor(api: LiftLogApi, sessionId: string, notify: Notifier) {
    this.#api = api;
    this.#id = sessionId;
    this.#notify = notify;
  }

  async load(): Promise<void> {
    try {
      const [session, sets, exercises, routines, quickAdds] = await Promise.all([
        this.#api.getSession(this.#id),
        this.#api.listSets(this.#id),
        this.#api.listExercises(true),
        this.#api.listRoutines(true),
        this.#api.listQuickAdds(),
      ]);
      this.session = session;
      this.sets = sortSets(sets);
      this.exercises = exercises;
      this.routines = routines;
      this.quickAdds = quickAdds;
      this.loadError = session ? undefined : 'This workout no longer exists.';
    } catch (err) {
      this.loadError = errorMessage(err);
    } finally {
      this.loaded = true;
    }
  }

  exercise(id: string): Exercise | undefined {
    return this.exercises.find((e) => e.id === id);
  }

  kind(id: string): ExerciseKind {
    return this.exercise(id)?.kind ?? 'barbell';
  }

  name(id: string): string {
    return this.exercise(id)?.name ?? 'Unknown exercise';
  }

  get title(): string {
    const r = this.routines.find((x) => x.id === this.session?.routineId);
    return r?.name ?? 'Workout';
  }

  #put(changed: LoggedSet[]) {
    const byId = new Map(changed.map((s) => [s.id, s]));
    const kept = this.sets.map((s) => byId.get(s.id) ?? s);
    const added = changed.filter((s) => !this.sets.some((x) => x.id === s.id));
    this.sets = sortSets([...kept, ...added]);
  }

  /** Optimistic write of one or more sets; on failure the screen goes back to what is stored. */
  async save(changed: LoggedSet | LoggedSet[]): Promise<void> {
    const list = Array.isArray(changed) ? changed : [changed];
    this.#put(list);
    try {
      for (const s of list) await this.#api.saveSet($state.snapshot(s) as LoggedSet);
    } catch (err) {
      this.#notify.error("Couldn't save that change.", err);
      await this.#reloadSets();
    }
  }

  async #reloadSets() {
    try {
      this.sets = sortSets(await this.#api.listSets(this.#id));
    } catch {
      // Keep what is on screen; the error toast already told the person.
    }
  }

  #snapshot(sets: LoggedSet[]): LoggedSet[] {
    return sets.map((s) => $state.snapshot(s) as LoggedSet);
  }

  /** Tap on an exercise name: done as planned for the whole exercise, with Undo. */
  async tapExercise(exerciseId: string): Promise<void> {
    const group = this.sets.filter((s) => s.exerciseId === exerciseId);
    const before = this.#snapshot(group);
    const changed = tapExercise(group, this.kind(exerciseId));
    if (!changed.length) return;
    await this.save(changed);
    const allDone = changed.every((s) => s.done);
    this.#notify.show(`${this.name(exerciseId)}: ${allDone ? 'done as planned' : 'cleared'}`, { undo: () => this.save(before) });
  }

  async toggleSkip(set: LoggedSet): Promise<void> {
    const before = this.#snapshot([set]);
    const skipped = !set.skipped;
    await this.save({ ...set, skipped, done: false });
    if (skipped) this.#notify.show(`Set ${set.setNo} skipped`, { undo: () => this.save(before) });
  }

  async addSet(exerciseId: string): Promise<void> {
    const group = this.sets.filter((s) => s.exerciseId === exerciseId);
    await this.save(setAfter(group, this.#id, exerciseId));
  }

  async removeSet(set: LoggedSet): Promise<void> {
    const before = this.sets;
    this.sets = this.sets.filter((s) => s.id !== set.id);
    try {
      const restore = await this.#api.deleteSet(set.id);
      this.#notify.show(`Set ${set.setNo} removed`, {
        undo: async () => {
          await restore();
          await this.#reloadSets();
        },
      });
    } catch (err) {
      this.sets = before;
      this.#notify.error("Couldn't remove that set.", err);
    }
  }

  async removeExercise(exerciseId: string): Promise<void> {
    const group = this.sets.filter((s) => s.exerciseId === exerciseId);
    this.sets = this.sets.filter((s) => s.exerciseId !== exerciseId);
    const restores: (() => Promise<void>)[] = [];
    try {
      for (const s of group) restores.push(await this.#api.deleteSet(s.id));
    } catch (err) {
      this.#notify.error("Couldn't remove every set.", err);
    }
    if (restores.length) {
      this.#notify.show(`${this.name(exerciseId)} removed`, {
        undo: async () => {
          for (const r of restores) await r();
          await this.#reloadSets();
        },
      });
    }
    await this.#reloadSets();
  }

  async addExercise(exerciseId: string): Promise<void> {
    let previous: Pick<LoggedSet, 'weightLb' | 'reps'> | undefined;
    try {
      const history = await this.#api.setHistory(exerciseId);
      previous = history[history.length - 1];
    } catch {
      // No history is fine: the set starts empty.
    }
    await this.save(firstSet(this.sets, this.#id, exerciseId, previous));
  }

  async swap(fromId: string, toId: string): Promise<void> {
    if (fromId === toId) return;
    const group = this.sets.filter((s) => s.exerciseId === fromId);
    const before = this.#snapshot(group);
    await this.save(swapExercise(group, toId));
    this.#notify.show(`Swapped ${this.name(fromId)} for ${this.name(toId)}`, { undo: () => this.save(before) });
  }

  async applyQuickAdd(quickAddId: string): Promise<void> {
    const name = this.quickAdds.find((q) => q.id === quickAddId)?.name ?? 'Quick-add';
    const beforeIds = new Set(this.sets.map((s) => s.id));
    try {
      await this.#api.applyQuickAdd(this.#id, quickAddId);
      await this.#reloadSets();
      const added = this.sets.filter((s) => !beforeIds.has(s.id));
      this.#notify.show(`${name} added`, {
        undo: async () => {
          for (const s of added) await this.#api.deleteSet(s.id);
          await this.#reloadSets();
        },
      });
    } catch (err) {
      this.#notify.error(`Couldn't add ${name}.`, err);
    }
  }

  /** Deletes the whole workout (draft or finished) with Undo; returns true when it is gone. */
  async discard(onRestored?: () => void): Promise<boolean> {
    try {
      const restore = await this.#api.deleteSession(this.#id);
      this.#notify.show('Workout deleted', {
        undo: async () => {
          await restore();
          onRestored?.();
        },
      });
      return true;
    } catch (err) {
      this.#notify.error("Couldn't delete the workout.", err);
      return false;
    }
  }
}
