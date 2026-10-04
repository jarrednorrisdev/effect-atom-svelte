<!--
  Beside the prerendering example: when a timestamp was taken, in the reader's own time zone, and
  how long ago, counted every second. Both are worked out in the browser after hydration; the
  server renders a placeholder, as it can't know the reader's clock or time zone.
  Presentation only: built-at.svelte holds the example's logic.
-->
<script lang="ts">
  const { at }: { at: number } = $props();

  let now = $state<number>();
  $effect(() => {
    now = Date.now();
    const timer = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(timer);
  });

  const ago = (ms: number) => {
    const seconds = Math.max(0, Math.round(ms / 1000));
    if (seconds < 60) {
      return seconds < 2 ? "just now" : `${seconds} seconds ago`;
    }
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return minutes === 1 ? "a minute ago" : `${minutes} minutes ago`;
    }
    const hours = Math.round(minutes / 60);
    if (hours < 48) {
      return hours === 1 ? "an hour ago" : `${hours} hours ago`;
    }
    return `${Math.round(hours / 24)} days ago`;
  };
</script>

{#if now === undefined}
  <span>at …</span>
{:else}
  <span>
    at {new Date(at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })},
    <output data-testid="stamp-age">{ago(now - at)}</output>
  </span>
{/if}
