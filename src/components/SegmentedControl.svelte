<script lang="ts" generics="T extends string | number">
  interface Props {
    options: { value: T; label: string }[];
    value?: T;
    label: string;
    onchange?: (value: T) => void;
  }
  let { options, value = $bindable(), label, onchange }: Props = $props();

  function select(v: T) {
    value = v;
    onchange?.(v);
  }

  // Arrow keys move the selection, like native radio groups.
  function keydown(e: KeyboardEvent, i: number) {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + options.length) % options.length;
    select(options[next].value);
    ((e.currentTarget as HTMLElement).parentElement?.children[next] as HTMLElement | undefined)?.focus();
  }
</script>

<div class="segmented" role="radiogroup" aria-label={label}>
  {#each options as option, i (option.value)}
    <button
      type="button"
      role="radio"
      aria-checked={option.value === value}
      tabindex={option.value === value || (value === undefined && i === 0) ? 0 : -1}
      onclick={() => select(option.value)}
      onkeydown={(e) => keydown(e, i)}
    >{option.label}</button>
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    gap: 2px;
    padding: 2px;
    background: var(--surface-2);
    border-radius: var(--radius);
  }
  button {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    border: 0;
    border-radius: calc(var(--radius) - 2px);
    background: transparent;
    color: var(--text);
    font: inherit;
    font-size: 0.9375rem;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: background calc(var(--motion, 250ms) * 0.6);
  }
  button[aria-checked='true'] { background: var(--surface); font-weight: 600; box-shadow: 0 1px 2px rgb(0 0 0 / 0.12); }
</style>
