// Small shape checks shared by the backup and program file validators.
import { isValidDate } from './dates';

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
export type FieldSpec = Record<string, FieldType | `${FieldType}?`>;

const MAX_ERRORS = 20;

export function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function matches(value: unknown, type: FieldType): boolean {
  switch (type) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'boolean': return typeof value === 'boolean';
    case 'date': return typeof value === 'string' && isValidDate(value);
    case 'array': return Array.isArray(value);
    case 'object': return isObject(value);
  }
}

/** Collects errors in `errors` (capped) for rows that don't match the spec. Returns true when all rows match. */
export function checkRows(table: string, rows: unknown, spec: FieldSpec, errors: string[]): rows is Record<string, unknown>[] {
  if (!Array.isArray(rows)) {
    push(errors, `${table}: expected a list`);
    return false;
  }
  let ok = true;
  rows.forEach((row, i) => {
    if (!isObject(row)) {
      ok = false;
      push(errors, `${table} #${i + 1}: expected an object`);
      return;
    }
    for (const [field, rawType] of Object.entries(spec)) {
      const optional = rawType.endsWith('?');
      const type = rawType.replace('?', '') as FieldType;
      const value = row[field];
      if (value === undefined || value === null) {
        if (!optional) {
          ok = false;
          push(errors, `${table} #${i + 1}: missing ${field}`);
        }
      } else if (!matches(value, type)) {
        ok = false;
        push(errors, `${table} #${i + 1}: ${field} should be ${type === 'date' ? 'a YYYY-MM-DD date' : `a ${type}`}`);
      }
    }
  });
  return ok;
}

export function push(errors: string[], message: string): void {
  if (errors.length < MAX_ERRORS) errors.push(message);
  else if (errors.length === MAX_ERRORS) errors.push('…more errors not shown');
}

/** Errors for duplicate ids in a list. */
export function checkUniqueIds(table: string, rows: { id?: unknown }[], errors: string[]): void {
  const seen = new Set<unknown>();
  for (const r of rows) {
    if (seen.has(r.id)) push(errors, `${table}: duplicate id ${String(r.id)}`);
    seen.add(r.id);
  }
}

export function parseJson(text: string): { value?: unknown; error?: string } {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { error: 'Not a valid JSON file' };
  }
}
