<!-- Log today's bodyweight: the stepper starts at the last weigh-in; Save writes it to the device. -->
<script lang="ts">
  import { api, type Bodyweight } from '../../db';
  import WeightStepper from './WeightStepper.svelte';
  import { formatDate } from '../progress/format';

  interface Props { entries: Bodyweight[]; today: string; }
  let { entries, today }: Props = $props();

  const sorted = $derived([...entries].sort((a, b) => (a.date < b.date ? -1 : 1)));
  const last = $derived(sorted.filter((e) => e.date <= today).at(-1));
  const todays = $derived(entries.find((e) => e.date === today));

  let value: number | undefined = $state();
  let touched = $state(false);
  let status: 'idle' | 'saving' | 'saved' | 'error' = $state('idle');
  let error = $state('');

  // Pre-fill with the last weigh-in until the person changes the value.
  $effect(() => {
    if (!touched && last) value = last.weightLb;
  });

  async function save() {
    if (value === undefined) return;
    status = 'saving';
    try {
      await api.logBodyweight(today, value);
      status = 'saved';
      touched = false;
    } catch (e) {
      status = 'error';
      error = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<section class="entry" aria-label="Log bodyweight">
  <div class="head">
    <h2>{formatDate(today)}</h2>
    {#if todays}
      <span class="note num">Logged {todays.weightLb.toFixed(1)} lb</span>
    {:else if last}
      <span class="note num">Last {last.weightLb.toFixed(1)} lb · {formatDate(last.date, today)}</span>
    {/if}
  </div>
  <WeightStepper bind:value onchange={() => { touched = true; status = 'idle'; }} />
  {#if value === undefined}
    <p class="hint">Type your weight to log your first weigh-in.</p>
  {/if}
  <button class="save" type="button" disabled={value === undefined || status === 'saving'} onclick={save}>
    {todays ? 'Update today' : 'Log weight'}
  </button>
  {#if status === 'saved'}
    <p class="ok" role="status">Saved {value?.toFixed(1)} lb for {formatDate(today)}.</p>
  {:else if status === 'error'}
    <p class="err" role="alert">Couldn't save this weigh-in. Your earlier weigh-ins are safe. Try again. ({error})</p>
  {/if}
</section>

<style>
  .entry { background: var(--surface); border-radius: var(--radius); padding: 12px var(--space) 16px; margin-bottom: 12px; }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
  h2 { font-size: 1.0625rem; font-weight: 600; margin: 0; }
  .note { color: var(--text-2); font-size: 0.8125rem; }
  .hint { margin: 8px 0 0; color: var(--text-2); font-size: 0.875rem; text-align: center; }
  .save {
    display: block; width: 100%; min-height: 50px; margin-top: 16px; border: 0; border-radius: var(--radius);
    background: var(--accent); color: var(--surface); font: inherit; font-weight: 600; transition: transform 120ms;
    -webkit-touch-callout: none;
  }
  .save:active:not(:disabled) { transform: scale(0.98); }
  .save:disabled { opacity: 0.45; }
  .save:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .ok, .err { margin: 8px 0 0; font-size: 0.875rem; text-align: center; }
  .ok { color: var(--text-2); }
  .err { color: var(--danger); }
</style>
