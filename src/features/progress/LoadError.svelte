<!-- Errors say what failed, whether data is safe, and what to do. -->
<script lang="ts">
  let { what, message }: { what: string; message: string } = $props();
</script>

<div class="error" role="alert">
  <p><strong>Couldn't load {what}.</strong> Your data is still saved on this device. Close and reopen the app to try again.</p>
  <p class="detail">{message}</p>
</div>

<style>
  .error { background: var(--surface); border-radius: var(--radius); padding: 12px var(--space); margin-bottom: 12px; }
  p { margin: 0; }
  strong { color: var(--danger); }
  .detail { margin-top: 6px; font-size: 0.8125rem; color: var(--text-2); }
</style>
