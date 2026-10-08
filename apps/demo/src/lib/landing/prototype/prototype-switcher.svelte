<!--
  PROTOTYPE (landing hero variants, ?variant=): throwaway, not for main.

  A floating bar to flip between the variants: the arrows, or ← and → on the keyboard. Dev only.
-->
<script lang="ts">
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  import { goto } from "$app/navigation";

  const {
    current,
    variants,
  }: { current: string; variants: readonly { key: string; name: string }[] } = $props();

  const index = $derived(Math.max(0, variants.findIndex((variant) => variant.key === current)));

  const go = (step: number) => {
    const next = variants[(index + step + variants.length) % variants.length]!;
    const url = new URL(location.href);
    url.searchParams.set("variant", next.key);
    void goto(url, { replace: true, reset: false });
  };

  const onkeydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, [contenteditable]")) {
      return;
    }
    if (event.key === "ArrowLeft") {
      go(-1);
    } else if (event.key === "ArrowRight") {
      go(1);
    }
  };
</script>

<svelte:window {onkeydown} />

<div class="switcher" role="toolbar" aria-label="Prototype variants">
  <button aria-label="Previous variant" onclick={() => go(-1)} type="button">
    <ChevronLeftIcon class="size-4" />
  </button>
  <span>
    <b>{variants[index]?.key.toUpperCase()}</b>
    {variants[index]?.name}
  </span>
  <button aria-label="Next variant" onclick={() => go(1)} type="button">
    <ChevronRightIcon class="size-4" />
  </button>
</div>

<style>
  .switcher {
    align-items: center;
    background: #18181b;
    border-radius: 999px;
    bottom: 1rem;
    box-shadow: 0 10px 30px -8px rgb(0 0 0 / 0.5);
    color: #fafafa;
    display: flex;
    font: 500 0.8rem/1 ui-sans-serif, system-ui, sans-serif;
    gap: 0.25rem;
    left: 50%;
    padding: 0.3rem;
    position: fixed;
    transform: translateX(-50%);
    z-index: 100;
    outline: 1px solid rgb(255 255 255 / 0.15);
  }
  span {
    min-width: 15rem;
    padding: 0 0.5rem;
    text-align: center;
  }
  b {
    color: #f59e0b;
    margin-right: 0.35rem;
  }
  button {
    border-radius: 999px;
    display: grid;
    height: 1.9rem;
    place-items: center;
    width: 1.9rem;
  }
  button:hover {
    background: rgb(255 255 255 / 0.12);
  }
</style>
