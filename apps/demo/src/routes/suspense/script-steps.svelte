<!--
  The script-await example's progress, drawn from its log: the lines of `<Notes>`'s script, each
  marked done, waiting or not reached, with when it ran. Not part of the example's code.
-->
<script lang="ts">
  import type { LogEntry } from "#lib/docs/kit/event-log.svelte.ts";

  interface Props {
    readonly entries: readonly LogEntry[];
  }

  const { entries }: Props = $props();

  const at = (label: string) => entries.find((entry) => entry.label === label)?.at;
  const started = $derived(at("script started"));
  const continued = $derived(at("script continued after the await"));

  // The await line waits from when the script starts until it continues.
  const awaitState = $derived.by(() => {
    if (continued !== undefined) {
      return "done";
    }
    return started === undefined ? "todo" : "waiting";
  });

  const steps = $derived([
    {
      code: "script.add(\"script started\")",
      state: started === undefined ? "todo" : "done",
      time: started,
    },
    {
      code: "const notes = await useAtomResult(notesAtom);",
      state: awaitState,
      time: continued,
    },
    {
      code: "script.add(\"script continued after the await\")",
      state: continued === undefined ? "todo" : "done",
      time: continued,
    },
  ]);
</script>

<ol aria-label="Script" class="steps not-prose" data-testid="script-steps">
  {#each steps as step (step.code)}
    <li data-state={step.state}>
      <span aria-hidden="true" class="mark"></span>
      <code>{step.code}</code>
      <span class="status">
        {#if step.state === "done"}
          ran at {step.time} ms
        {:else if step.state === "waiting"}
          waiting for the first result…
        {:else}
          not reached
        {/if}
      </span>
    </li>
  {/each}
</ol>

<style>
  .steps {
    border-top: 1px dashed var(--border-strong);
    display: grid;
    gap: 0.35rem;
    list-style: none;
    margin: 1rem 0 0;
    padding: 0.75rem 0 0;
  }
  li {
    align-items: baseline;
    display: grid;
    gap: 0.5rem;
    grid-template-columns: 0.6rem 1fr auto;
    margin: 0;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    overflow-wrap: anywhere;
  }
  .mark {
    align-self: center;
    background: var(--tone-idle);
    border-radius: 999px;
    height: 0.55rem;
    width: 0.55rem;
  }
  .status {
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    white-space: nowrap;
  }
  [data-state="todo"] code {
    color: var(--muted-foreground);
  }
  [data-state="done"] .mark {
    background: var(--tone-success);
  }
  [data-state="waiting"] .mark {
    animation: wait 0.9s ease-in-out infinite alternate;
    background: var(--tone-running);
  }
  [data-state="waiting"] .status {
    color: var(--tone-running-text);
  }
  @keyframes wait {
    to {
      opacity: 0.3;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-state="waiting"] .mark {
      animation: none;
    }
  }
</style>
