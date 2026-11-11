<script lang="ts">
  interface Props { href: string; label: string; }
  let { href, label }: Props = $props();
</script>

<div class="screen-head"><a class="back" {href}>‹ {label}</a></div>

<style>
  .back { display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; color: var(--accent); text-decoration: none; }
</style>
