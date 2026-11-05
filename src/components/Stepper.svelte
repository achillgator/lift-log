<script lang="ts">
  import Minus from 'lucide-svelte/icons/minus';
  import Plus from 'lucide-svelte/icons/plus';
  import { holdDelay, stepValue } from './stepper';

  interface Props {
    value?: number;
    label: string;
    step?: number;
    min?: number;
    max?: number;
    /** Shown muted when there is no value yet, and used as the starting point for the first step. */
    placeholder?: number;
    unit?: string;
    format?: (n: number) => string;
    parse?: (text: string) => number | undefined;
    onchange?: (value: number) => void;
    disabled?: boolean;
  }
  let {
    value = $bindable(),
    label,
    step = 1,
    min = 0,
    max = Number.POSITIVE_INFINITY,
    placeholder,
    unit,
    format = (n: number) => String(n),
    parse = (t: string) => (t.trim() === '' || !Number.isFinite(Number(t)) ? undefined : Number(t)),
    onchange,
    disabled = false,
  }: Props = $props();

  let timer: ReturnType<typeof setTimeout> | undefined;

  function bump(dir: 1 | -1) {
    const next = stepValue(value ?? placeholder ?? 0, dir * step, min, max);
    if (next === value) return;
    value = next;
    onchange?.(next);
  }

  // Press-and-hold: one step on press, then repeats that speed up until release.
  function press(dir: 1 | -1, e: PointerEvent) {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    stop();
    bump(dir);
    let repeats = 0;
    const tick = () => {
      repeats += 1;
      bump(dir);
      timer = setTimeout(tick, holdDelay(repeats));
    };
    timer = setTimeout(tick, holdDelay(0));
  }

  function stop() {
    clearTimeout(timer);
    timer = undefined;
  }

  // Keyboard activation (Enter/Space) reports detail 0; pointer presses are handled above.
  function key(dir: 1 | -1, e: MouseEvent) {
    if (e.detail === 0) bump(dir);
  }

  function commit(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const parsed = parse(input.value);
    if (parsed === undefined) {
      input.value = value === undefined ? '' : format(value);
      return;
    }
    const next = Math.min(max, Math.max(min, parsed));
    input.value = format(next);
    if (next === value) return;
    value = next;
    onchange?.(next);
  }

  $effect(() => stop);
</script>

<div class="stepper" role="group" aria-label={label}>
  <button
    type="button"
    class="step"
    aria-label="Decrease {label}"
    {disabled}
    onpointerdown={(e) => press(-1, e)}
    onpointerup={stop}
    onpointerleave={stop}
    onpointercancel={stop}
    onclick={(e) => key(-1, e)}
    oncontextmenu={(e) => e.preventDefault()}
  ><Minus size={20} aria-hidden="true" /></button>
  <label class="field">
    <span class="visually-hidden">{label}</span>
    <input
      class="num"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      value={value === undefined ? '' : format(value)}
      placeholder={placeholder === undefined ? '–' : format(placeholder)}
      {disabled}
      onchange={commit}
      onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
    />
    {#if unit}<span class="unit" aria-hidden="true">{unit}</span>{/if}
  </label>
  <button
    type="button"
    class="step"
    aria-label="Increase {label}"
    {disabled}
    onpointerdown={(e) => press(1, e)}
    onpointerup={stop}
    onpointerleave={stop}
    onpointercancel={stop}
    onclick={(e) => key(1, e)}
    oncontextmenu={(e) => e.preventDefault()}
  ><Plus size={20} aria-hidden="true" /></button>
</div>

<style>
  .stepper {
    display: inline-flex;
    align-items: center;
    background: var(--surface-2);
    border-radius: var(--radius);
    min-height: 44px;
  }
  .step {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border: 0;
    background: transparent;
    color: var(--accent);
    border-radius: var(--radius);
    touch-action: manipulation;
    -webkit-touch-callout: none;
    user-select: none;
    cursor: pointer;
  }
  .step:active:not(:disabled) { transform: scale(0.92); }
  .step:disabled { color: var(--text-2); opacity: 0.5; }
  .field { display: inline-flex; align-items: baseline; gap: 2px; }
  input {
    width: 4.5ch;
    min-height: 44px;
    border: 0;
    background: transparent;
    color: var(--text);
    text-align: center;
    font-size: 1.0625rem;
    font-weight: 600;
    font-family: var(--font-num, inherit);
    padding: 0;
  }
  input::placeholder { color: var(--text-2); font-weight: 400; }
  .unit { color: var(--text-2); font-size: 0.8125rem; }
</style>
