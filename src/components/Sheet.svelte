<script lang="ts">
  import type { Snippet } from 'svelte';
  import { dim, rise } from './motion';

  interface Props {
    title: string;
    onclose: () => void;
    /** 'full' covers the screen (the Log sheet); 'bottom' is a drag-to-dismiss sheet for add/edit flows. */
    variant?: 'bottom' | 'full';
    /** Left side of the header (defaults to a Close button). */
    leading?: Snippet;
    /** Right side of the header, usually the primary action. */
    trailing?: Snippet;
    footer?: Snippet;
    children: Snippet;
  }
  let { title, onclose, variant = 'bottom', leading, trailing, footer, children }: Props = $props();

  let panel = $state<HTMLElement>();
  let dragY = $state(0);
  let dragging = $state(false);
  let startY = 0;
  let startT = 0;
  const titleId = `sheet-${Math.random().toString(36).slice(2, 9)}`;

  $effect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  });

  function keydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onclose();
    }
  }

  // Drag-to-dismiss tracks the finger 1:1 from the grab handle / header.
  function down(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    dragging = true;
    startY = e.clientY;
    startT = performance.now();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (dragging) dragY = Math.max(0, e.clientY - startY);
  }
  function up() {
    if (!dragging) return;
    dragging = false;
    const velocity = dragY / Math.max(1, performance.now() - startT);
    if (dragY > 120 || velocity > 0.6) onclose();
    dragY = 0;
  }
</script>

<!-- One layer per sheet, so a sheet opened from another stacks (and dims) above it. -->
<div class="layer">
<div class="backdrop" transition:dim onclick={onclose} aria-hidden="true"></div>
<div
  bind:this={panel}
  class="sheet {variant}"
  class:dragging
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
  tabindex="-1"
  style:transform={dragY ? `translateY(${dragY}px)` : undefined}
  onkeydown={keydown}
  transition:rise
>
  <header onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
    {#if variant === 'bottom'}<div class="handle" aria-hidden="true"></div>{/if}
    <div class="bar">
      <div class="side">
        {#if leading}{@render leading()}{:else}<button type="button" class="text-btn" onclick={onclose}>Close</button>{/if}
      </div>
      <h2 id={titleId}>{title}</h2>
      <div class="side end">{#if trailing}{@render trailing()}{/if}</div>
    </div>
  </header>
  <div class="body">{@render children()}</div>
  {#if footer}<footer>{@render footer()}</footer>{/if}
</div>
</div>

<style>
  .layer { position: fixed; inset: 0; z-index: 40; }
  .backdrop { position: absolute; inset: 0; background: rgb(0 0 0 / 0.4); }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    color: var(--text);
    outline: none;
    transition: transform calc(var(--motion, 250ms) * 0.8) ease-out;
  }
  .sheet.dragging { transition: none; }
  .bottom { max-height: 88dvh; border-radius: var(--radius) var(--radius) 0 0; }
  .full { top: 0; padding-top: env(safe-area-inset-top); }
  header { flex: none; touch-action: none; user-select: none; }
  .handle { width: 36px; height: 5px; border-radius: 3px; background: var(--separator); margin: 6px auto 0; }
  .bar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; min-height: 52px; padding: 0 8px; }
  .side { display: flex; align-items: center; }
  .end { justify-content: flex-end; }
  h2 { margin: 0; font-size: 1.0625rem; font-weight: 600; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60vw; }
  .body { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 0 var(--space) var(--space); }
  footer { flex: none; padding: 8px var(--space) calc(8px + env(safe-area-inset-bottom)); border-top: 1px solid var(--separator); background: var(--bg); }
  .bottom .body { padding-bottom: calc(var(--space) + env(safe-area-inset-bottom)); }
  .text-btn { min-height: 44px; min-width: 44px; padding: 0 8px; border: 0; background: none; color: var(--accent); font: inherit; cursor: pointer; }
</style>
