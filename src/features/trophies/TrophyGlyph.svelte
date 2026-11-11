<!-- The custom trophy glyph, drawn at Lucide's 2 px stroke on a 24 px grid. Color comes from the parent. -->
<script lang="ts">
  let { size = 24 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
  <path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 4" />
  <path d="M17 6h2.5a2.5 2.5 0 0 1-2.6 4" />
  <path d="M12 14v4" />
  <path d="M8 20h8" />
</svg>
