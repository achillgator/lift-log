<!--
  Bodyweight stepper: minus / value / plus in 0.2 lb steps, press-and-hold to repeat (speeds up),
  and the value can be typed. Kept in the body feature (src/components is owned elsewhere).
-->
<script lang="ts">
  import { stepWeight } from '../../lib/stats';

  interface Props { value?: number; min?: number; max?: number; onchange?: (v: number) => void; }
  let { value = $bindable(), min = 20, max = 1000, onchange }: Props = $props();

  let text = $state('');
  let invalid = $state(false);
  $effect(() => {
    text = value === undefined ? '' : value.toFixed(1);
  });

  function set(v: number) {
    value = Math.min(max, Math.max(min, v));
    invalid = false;
    onchange?.(value);
  }
  function step(dir: 1 | -1) {
    if (value !== undefined) set(stepWeight(value, dir));
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  function hold(dir: 1 | -1, e: PointerEvent) {
    if (value === undefined) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    step(dir);
    let n = 0;
    const tick = () => {
      step(dir);
      n++;
      timer = setTimeout(tick, n > 10 ? 40 : 110);
    };
    timer = setTimeout(tick, 400);
  }
  function release() {
    clearTimeout(timer);
    timer = undefined;
  }
  function keyStep(dir: 1 | -1, e: MouseEvent) {
    // Pointer presses step on pointerdown; keyboard activation arrives as a click with detail 0.
    if (e.detail === 0) step(dir);
  }
  function typed() {
    const v = Number(text.replace(',', '.'));
    if (text.trim() === '' || !Number.isFinite(v) || v < min || v > max) {
      invalid = true;
      return;
    }
    set(Math.round(v * 10) / 10);
  }
</script>

<div class="stepper">
  <button type="button" aria-label="Decrease by 0.2 lb" disabled={value === undefined}
    onpointerdown={(e) => hold(-1, e)} onpointerup={release} onpointercancel={release} onlostpointercapture={release}
    onclick={(e) => keyStep(-1, e)}>−</button>
  <label class="value">
    <span class="sr">Bodyweight in lb</span>
    <input class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="Weight" bind:value={text}
      onchange={typed} aria-invalid={invalid} aria-describedby={invalid ? 'bw-invalid' : undefined} />
    <span class="unit">lb</span>
  </label>
  <button type="button" aria-label="Increase by 0.2 lb" disabled={value === undefined}
    onpointerdown={(e) => hold(1, e)} onpointerup={release} onpointercancel={release} onlostpointercapture={release}
    onclick={(e) => keyStep(1, e)}>+</button>
</div>
{#if invalid}<p id="bw-invalid" class="invalid">Enter a weight between {min} and {max} lb.</p>{/if}

<style>
  .stepper { display: flex; align-items: center; gap: 12px; }
  button {
    width: 56px; height: 56px; flex: none; border: 0; border-radius: 50%; background: var(--surface-2); color: var(--text);
    font: inherit; font-size: 1.75rem; line-height: 1; -webkit-touch-callout: none; user-select: none; touch-action: none;
    transition: transform 120ms;
  }
  button:active:not(:disabled) { transform: scale(0.96); }
  button:disabled { opacity: 0.4; }
  button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .value { flex: 1; display: flex; align-items: baseline; justify-content: center; gap: 6px; }
  input {
    width: 5.5ch; border: 0; background: none; color: var(--text); text-align: right; padding: 0;
    font: inherit; font-size: var(--big-number); font-weight: 700; letter-spacing: -0.02em;
  }
  input::placeholder { color: var(--text-2); font-size: 1.25rem; font-weight: 500; }
  input[aria-invalid='true'] { color: var(--danger); }
  .unit { color: var(--text-2); font-size: 1.0625rem; }
  .invalid { margin: 6px 0 0; color: var(--danger); font-size: 0.8125rem; text-align: center; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
