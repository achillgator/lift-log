<!-- Small segmented control kept inside the progress feature (src/components is owned elsewhere). -->
<script lang="ts" generics="T extends string">
  interface Props { options: readonly T[]; value: T; label: string; onchange: (value: T) => void; }
  let { options, value, label, onchange }: Props = $props();
</script>

<div class="seg" role="radiogroup" aria-label={label}>
  {#each options as option}
    <button type="button" role="radio" aria-checked={option === value} onclick={() => onchange(option)}>{option}</button>
  {/each}
</div>

<style>
  .seg { display: flex; padding: 2px; gap: 2px; background: var(--surface-2); border-radius: 9px; }
  button {
    flex: 1; min-height: 44px; border: 0; border-radius: 7px; background: none; color: var(--text);
    font: inherit; font-size: 0.8125rem; font-weight: 500; -webkit-touch-callout: none; user-select: none;
    transition: background-color 200ms, transform 150ms;
  }
  button:active { transform: scale(0.97); }
  button[aria-checked='true'] { background: var(--surface); font-weight: 600; box-shadow: 0 1px 2px rgb(0 0 0 / 0.12); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
</style>
