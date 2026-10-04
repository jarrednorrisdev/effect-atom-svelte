<!--
  The server render and the browser side by side, for the example on the Hydration page. The box
  where whereAtom's current result was computed is lit; the browser's box runs while it computes
  again. Presentation only: where.svelte holds the example's logic.
-->
<script lang="ts">
  import ArrowIcon from "@lucide/svelte/icons/arrow-right";
  import MonitorIcon from "@lucide/svelte/icons/monitor";
  import ServerIcon from "@lucide/svelte/icons/server";
  import Part from "#lib/docs/kit/part.svelte";
  import type { Tone } from "#lib/docs/kit/tone.ts";

  interface Props {
    /** whereAtom's value: "the server" or "the browser". */
    readonly computedOn: string;
    readonly waiting: boolean;
  }

  const { computedOn, waiting }: Props = $props();

  const fromServer = $derived(computedOn === "the server");
  const browserTone: Tone = $derived.by(() => {
    if (waiting) {
      return "running";
    }
    return fromServer ? "idle" : "success";
  });
</script>

<div class="parts not-prose">
  <Part
    data-testid="where-server"
    dashed={!fromServer}
    label="Server render"
    tone={fromServer ? "success" : "idle"}
  >
    <p class="line">
      <ServerIcon aria-hidden="true" class="icon" />
      <strong>{fromServer ? "Rendered on the server" : "Not this result"}</strong>
    </p>
    <p class="note">
      {fromServer
        ? "Ran the effect and wrote the result into the page."
        : "The result on screen came from the browser."}
    </p>
  </Part>
  <span class="arrow" aria-hidden="true">
    <span class="arrow-label">result in the page</span>
    <ArrowIcon class="icon" />
  </span>
  <Part data-testid="where-browser" label="Browser" tone={browserTone}>
    <p class="line">
      <MonitorIcon aria-hidden="true" class="icon" />
      <strong>
        {#if waiting}
          Computing in the browser…
        {:else if fromServer}
          Hydrated, not computed
        {:else}
          Computed in the browser
        {/if}
      </strong>
    </p>
    <p class="note">
      {#if waiting}
        Running the effect, keeping the old result meanwhile.
      {:else if fromServer}
        Started from the server's result. The effect never ran here.
      {:else}
        Ran the effect itself.
      {/if}
    </p>
  </Part>
</div>

<style>
  .parts {
    align-items: stretch;
    display: grid;
    gap: 0.5rem;
    grid-template-columns: 1fr auto 1fr;
    margin-top: 0.75rem;
  }
  .line {
    align-items: center;
    display: flex;
    gap: 0.4rem;
    margin: 0;
  }
  .note {
    color: var(--muted-foreground);
    font-size: 0.8rem;
    margin: 0.25rem 0 0;
  }
  .parts :global(.icon) {
    flex: none;
    height: 1rem;
    width: 1rem;
  }
  .arrow {
    align-items: center;
    color: var(--muted-foreground);
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .arrow-label {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    max-width: 7.5rem;
    text-align: center;
  }
  @media (width < 40rem) {
    .parts {
      grid-template-columns: 1fr;
    }
    .arrow {
      flex-direction: row;
      gap: 0.4rem;
    }
    .arrow :global(.icon) {
      transform: rotate(90deg);
    }
    .arrow-label {
      max-width: none;
    }
  }
</style>
