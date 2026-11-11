<script lang="ts">
  import { api } from '../../db';
  import type { Exercise, Routine, Session, Settings } from '../../db/types';
  import { go } from '../../lib/router';
  import Banner from '../../components/Banner.svelte';
  import Button from '../../components/Button.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { daysSince, needsBackup, weekStrip } from './home';
  import { formatDate, todayISO } from '../../components/format';
  import { query } from '../../components/query.svelte';
  import { showError, toasts } from '../../components/toasts.svelte';
  import StartSheet from '../log/StartSheet.svelte';
  import { exportBackup } from '../settings/files';

  const today = todayISO();
  const settings = query<Settings | undefined>(() => api.getSettings(), undefined);
  const planned = query<Routine | undefined>(() => api.routineForDate(today), undefined);
  const routines = query<Routine[]>(() => api.listRoutines(), []);
  const exercises = query<Exercise[]>(() => api.listExercises(true), []);
  const finished = query<Session[]>(() => api.listSessions('done'), []);
  const drafts = query<Session[]>(() => api.listSessions('draft'), []);

  let picking = $state(false);
  let starting = $state(false);
  let backupHidden = $state(false);

  const loadError = $derived(settings.error ?? planned.error ?? routines.error ?? finished.error ?? drafts.error);
  const strip = $derived(weekStrip(today, finished.value, routines.value));
  const showBackup = $derived(!backupHidden && settings.loaded && !settings.error && needsBackup(settings.value?.lastExportAt, finished.value.length > 0));
  const loggedToday = $derived(finished.value.some((s) => s.date === today));

  const exerciseName = (id: string) => exercises.value.find((e) => e.id === id)?.name ?? 'Exercise';
  const routineName = (id?: string) => (id ? routines.value.find((r) => r.id === id)?.name : undefined) ?? 'Workout';

  function plan(r: Routine): string {
    return r.items
      .map((i) => `${exerciseName(i.exerciseId)} ${i.sets}×${i.repsMax ? `${i.reps}–${i.repsMax}` : i.reps}`)
      .join(' · ');
  }

  async function start(routineId?: string) {
    if (starting) return;
    starting = true;
    picking = false;
    try {
      const session = await api.startSession(today, routineId);
      go(`log/${session.id}`);
    } catch (err) {
      showError("Couldn't start the workout.", err);
    } finally {
      starting = false;
    }
  }

  async function backup() {
    try {
      if (await exportBackup()) {
        backupHidden = true;
        toasts.show('Backup exported.');
      }
    } catch (err) {
      showError("Couldn't export the backup.", err, 'Try again from Settings → Export.');
    }
  }
</script>

<div class="screen">
  <h1 class="title-large">Today</h1>
  <p class="footnote date">{formatDate(today)}</p>

  {#if loadError}
    <Banner tone="danger" title="Couldn't load your log" message="Nothing was lost. Close and reopen the app; if it keeps happening, export a backup in Settings. ({loadError})" />
  {/if}

  {#each drafts.value as d (d.id)}
    <Banner title="Workout in progress" message="{routineName(d.routineId)} · {formatDate(d.date)}" actionLabel="Resume" onaction={() => go(`log/${d.id}`)} />
  {/each}

  {#if showBackup}
    <Banner
      tone="warning"
      title="Back up your log"
      message={settings.value?.lastExportAt ? `Last export was ${daysSince(settings.value.lastExportAt)} days ago.` : 'You have never exported a backup.'}
      actionLabel="Export"
      onaction={backup}
      ondismiss={() => (backupHidden = true)}
    />
  {/if}

  <section class="today">
    {#if planned.value}
      <p class="footnote">{loggedToday ? 'Logged today' : 'Planned today'}</p>
      <h2 class="title">{planned.value.name}</h2>
      {#if planned.value.items.length}<p class="plan">{plan(planned.value)}</p>{/if}
      <Button variant="primary" block disabled={starting} onclick={() => start(planned.value?.id)}>Log today</Button>
      <Button variant="plain" block onclick={() => (picking = true)}>Log something else</Button>
    {:else}
      <EmptyState message="Nothing planned today" actionLabel="Log anyway" onaction={() => (picking = true)} />
    {/if}
  </section>

  <ol class="strip" aria-label="This week">
    {#each strip as d (d.date)}
      <li class:today={d.isToday} aria-label="{formatDate(d.date)}{d.done ? ', workout logged' : d.planned ? ', routine planned' : ''}">
        <span class="letter" aria-hidden="true">{d.letter}</span>
        <span class="day num" aria-hidden="true">{d.day}</span>
        <span class="mark" class:done={d.done} class:planned={d.planned && !d.done} aria-hidden="true"></span>
      </li>
    {/each}
  </ol>

  <!-- Trophies slot: another session builds src/features/trophies/TrophiesRow.svelte; import and render it here. -->
  <div class="trophies-slot" data-slot="trophies-row">
    {#if import.meta.env.DEV}<div class="slot">Trophies row goes here (TrophiesRow.svelte)</div>{/if}
  </div>
</div>

{#if picking}
  <StartSheet routines={routines.value} onpick={start} onclose={() => (picking = false)} />
{/if}

<style>
  .date { margin-bottom: 16px; }
  .today { display: flex; flex-direction: column; gap: 8px; padding: var(--space); margin-bottom: 24px; background: var(--surface); border-radius: var(--radius); }
  .today .title { margin: 0; }
  .plan { margin: 0 0 8px; color: var(--text-2); font-size: 0.9375rem; }
  .strip { list-style: none; display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin: 0 0 24px; padding: 0; }
  .strip li { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 0; border-radius: var(--radius); }
  .strip li.today { background: var(--surface); box-shadow: inset 0 0 0 2px var(--accent); }
  .letter { font-size: 0.75rem; color: var(--text-2); }
  .day { font-weight: 600; }
  .mark { width: 8px; height: 8px; border-radius: 50%; }
  .mark.done { background: var(--accent); }
  .mark.planned { box-shadow: inset 0 0 0 1.5px var(--text-2); }
</style>
