<script lang="ts">
  interface Props { checked?: boolean; label: string; disabled?: boolean; onchange?: (checked: boolean) => void; }
  let { checked = $bindable(false), label, disabled = false, onchange }: Props = $props();
</script>

<button
  type="button"
  role="switch"
  class="switch"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  onclick={() => { checked = !checked; onchange?.(checked); }}
><span class="knob" aria-hidden="true"></span></button>

<style>
  .switch {
    flex: none;
    position: relative;
    width: 51px;
    height: 44px;
    border: 0;
    padding: 0;
    background: none;
    cursor: pointer;
  }
  .switch::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 6px;
    height: 31px;
    border-radius: 16px;
    background: var(--surface-2);
    box-shadow: inset 0 0 0 1px var(--separator);
    transition: background calc(var(--motion, 250ms) * 0.8);
  }
  .switch[aria-checked='true']::before { background: var(--accent); box-shadow: none; }
  .knob {
    position: absolute;
    top: 8px;
    left: 2px;
    width: 27px;
    height: 27px;
    border-radius: 50%;
    background: var(--surface);
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
    transition: transform calc(var(--motion, 250ms) * 0.8) ease-out;
  }
  .switch[aria-checked='true'] .knob { transform: translateX(20px); }
  .switch:disabled { opacity: 0.45; }
</style>
