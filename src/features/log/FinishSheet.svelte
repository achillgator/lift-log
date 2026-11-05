<script lang="ts">
  // Finish summary: time, calories, volume, sets, PRs, optional effort, pain flag and note.
  // Also the "Done" sheet when editing a finished workout from History.
  import { api } from '../../db';
  import type { LoggedSet, Session } from '../../db/types';
  import Sheet from '../../components/Sheet.svelte';
  import Button from '../../components/Button.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Switch from '../../components/Switch.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import ListGroup from '../../components/ListGroup.svelte';
  import ListRow from '../../components/ListRow.svelte';
  import { formatLb, formatNumber } from '../../components/format';
  import { showError, toasts } from '../../components/toast.svelte';
  import { defaultDuration, findPrs, summarize, type Pr } from './logic';

  interface Props { session: Session; sets: LoggedSet[]; name: (exerciseId: string) => string; onclose: () => void; ondone: () => void; }
  let { session, sets, name, onclose, ondone }: Props = $props();

  // svelte-ignore state_referenced_locally
  const editing = session.status === 'done';
  // svelte-ignore state_referenced_locally
  let draft = $state<Session>({ ...session, durationMin: session.durationMin ?? defaultDuration(session.startedAt) });
  let prs = $state<Pr[]>([]);
  let saving = $state(false);
  const summary = $derived(summarize(sets));
  const efforts = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));

  $effect(() => {
    const ids = [...new Set(sets.filter((s) => s.done).map((s) => s.exerciseId))];
    Promise.all(ids.map(async (id) => [id, await api.setHistory(id)] as const))
      .then((entries) => (prs = findPrs(sets, Object.fromEntries(entries))))
      .catch(() => (prs = []));
  });

  // Each field writes straight to the stored session, so a reload keeps it (rule 4).
  async function update(patch: Partial<Session>) {
    draft = { ...draft, ...patch };
    try {
      await api.updateSession($state.snapshot(draft) as Session);
    } catch (err) {
      showError("Couldn't save that change.", err);
    }
  }

  async function finish() {
    saving = true;
    try {
      if (editing) {
        await api.updateSession($state.snapshot(draft) as Session);
        toasts.show('Changes saved.');
      } else {
        await api.finishSession(session.id, {
          durationMin: draft.durationMin ?? 1,
          calories: draft.calories,
          effort: draft.effort,
          painFlag: draft.painFlag,
          note: draft.note,
        });
        toasts.show(prs.length ? `Workout saved. ${prs.length} PR${prs.length > 1 ? 's' : ''}!` : 'Workout saved.');
        // Ask the browser to keep the data after the first real workout (a "no" is normal on iOS).
        api.requestPersistence().catch(() => {});
      }
      ondone();
    } catch (err) {
      showError("Couldn't finish the workout.", err, 'Your sets are saved as a draft; try Finish again.');
    } finally {
      saving = false;
    }
  }
</script>

<Sheet title={editing ? 'Workout summary' : 'Finish workout'} {onclose}>
  {#snippet leading()}<Button size="small" variant="plain" onclick={onclose}>Back</Button>{/snippet}
  {#snippet trailing()}<Button size="small" variant="primary" disabled={saving} onclick={finish}>{editing ? 'Save' : 'Finish'}</Button>{/snippet}

  <div class="stats">
    <div><span class="big-number">{formatNumber(summary.volumeLb)}</span><span class="footnote">lb volume</span></div>
    <div><span class="big-number">{summary.doneSets}</span><span class="footnote">sets{summary.skippedSets ? ` · ${summary.skippedSets} skipped` : ''}</span></div>
    <div><span class="big-number pr">{prs.length}</span><span class="footnote">PRs</span></div>
  </div>

  {#if prs.length}
    <ListGroup header="Personal records (estimated 1RM)">
      {#each prs as pr (pr.exerciseId)}
        <ListRow label={name(pr.exerciseId)} detail="Was {formatLb(Math.round(pr.previous))} lb" value="{formatLb(Math.round(pr.e1rm))} lb" />
      {/each}
    </ListGroup>
  {/if}

  <ListGroup header="Workout">
    <ListRow label="Duration">
      {#snippet trailing()}
        <Stepper label="Duration in minutes" unit="min" min={1} max={600} value={draft.durationMin} onchange={(v) => update({ durationMin: v })} />
      {/snippet}
    </ListRow>
    <ListRow label="Calories" detail="Optional">
      {#snippet trailing()}
        <input
          class="cal num"
          type="text"
          inputmode="numeric"
          aria-label="Calories"
          placeholder="–"
          value={draft.calories ?? ''}
          onchange={(e) => {
            const v = parseInt(e.currentTarget.value, 10);
            update({ calories: Number.isFinite(v) && v >= 0 ? v : undefined });
          }}
        />
      {/snippet}
    </ListRow>
    <ListRow label="Pain or injury" detail="Flag this workout">
      {#snippet trailing()}<Switch label="Pain or injury" checked={draft.painFlag} onchange={(v) => update({ painFlag: v })} />{/snippet}
    </ListRow>
  </ListGroup>

  <section class="effort">
    <div class="effort-head">
      <h3 class="footnote">Effort (optional): 1 easy · 10 all-out</h3>
      {#if draft.effort !== undefined}<Button size="small" variant="plain" onclick={() => update({ effort: undefined })}>Clear</Button>{/if}
    </div>
    <SegmentedControl label="Effort, 1 to 10" options={efforts} value={draft.effort} onchange={(v) => update({ effort: v })} />
  </section>

  <label class="note">
    <span class="footnote">Note</span>
    <textarea rows="3" value={draft.note} onchange={(e) => update({ note: e.currentTarget.value })}></textarea>
  </label>
</Sheet>

<style>
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 8px 0 24px; text-align: center; }
  .stats div { display: flex; flex-direction: column; }
  .pr { color: var(--pr); }
  .cal { width: 6ch; min-height: 44px; border: 0; background: var(--surface-2); border-radius: var(--radius); color: var(--text); text-align: center; }
  .effort { margin-bottom: 24px; }
  .effort-head { display: flex; align-items: center; justify-content: space-between; min-height: 44px; padding: 0 var(--space); }
  .effort-head h3 { font-weight: 400; }
  .note { display: flex; flex-direction: column; gap: 6px; padding: 0 0 24px; }
  .note span { padding: 0 var(--space); }
</style>
