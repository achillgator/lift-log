import type { QuickAdd } from '../../db/types';

export type QuickAddKind = 'routine' | 'items' | 'lines';

export function quickAddKind(q: QuickAdd): QuickAddKind {
  return 'routineId' in q.source ? 'routine' : 'items' in q.source ? 'items' : 'lines';
}

export function quickAddDetail(q: QuickAdd): string {
  const s = q.source;
  if ('routineId' in s) return 'Routine';
  if ('items' in s) return `${s.items.length} exercise${s.items.length === 1 ? '' : 's'}`;
  return `${s.lines.length} checklist line${s.lines.length === 1 ? '' : 's'}`;
}

/** Switching kind starts that kind empty (a routine source starts with the first routine). */
export function withKind(q: QuickAdd, kind: QuickAddKind, firstRoutineId?: string): QuickAdd {
  if (kind === quickAddKind(q)) return q;
  if (kind === 'routine') return { ...q, source: { routineId: firstRoutineId ?? '' } };
  if (kind === 'items') return { ...q, source: { items: [] } };
  return { ...q, source: { lines: [] } };
}

/** Textarea text to checklist lines: trimmed, blank lines dropped. */
export function toLines(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}
