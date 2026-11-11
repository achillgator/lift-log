// App-wide toast queue. Undo toasts replace "Are you sure?" dialogs (SPEC: only bulk actions confirm).
import { errorMessage } from './format';

export interface ToastItem {
  id: number;
  message: string;
  tone: 'default' | 'error';
  undo?: () => unknown;
  duration: number;
}

class Toasts {
  items = $state<ToastItem[]>([]);
  #next = 1;
  #timers = new Map<number, ReturnType<typeof setTimeout>>();

  show(message: string, opts: { undo?: () => unknown; tone?: ToastItem['tone']; duration?: number } = {}): number {
    const id = this.#next++;
    const item: ToastItem = { id, message, tone: opts.tone ?? 'default', undo: opts.undo, duration: opts.duration ?? (opts.undo ? 6000 : 3500) };
    // Keep the newest few; older ones would only cover the screen.
    this.items = [...this.items.slice(-2), item];
    this.#timers.set(id, setTimeout(() => this.dismiss(id), item.duration));
    return id;
  }

  dismiss(id: number): void {
    clearTimeout(this.#timers.get(id));
    this.#timers.delete(id);
    this.items = this.items.filter((t) => t.id !== id);
  }

  async undo(id: number): Promise<void> {
    const item = this.items.find((t) => t.id === id);
    this.dismiss(id);
    try {
      await item?.undo?.();
    } catch (err) {
      showError("Couldn't undo that.", err);
    }
  }
}

export const toasts = new Toasts();

/** Error toast that says what failed, that saved data is safe, and what to do next. */
export function showError(what: string, err?: unknown, next = 'Try again.'): void {
  if (err !== undefined) console.error(what, err);
  const detail = err === undefined ? '' : ` (${errorMessage(err)})`;
  toasts.show(`${what} Data already saved is safe. ${next}${detail}`, { tone: 'error', duration: 8000 });
}
