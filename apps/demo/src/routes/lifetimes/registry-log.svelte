<!--
  The lifetimes example's log as a timed event log: each entry the atoms write ("plain:
  computed") gets the time it arrived, so the idle TTL's delay shows. Not part of the example's
  code.
-->
<script lang="ts">
  import EventLog from "#lib/docs/kit/event-log.svelte";
  import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";
  import { untrack } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    readonly events: readonly { readonly atom: string; readonly event: string }[];
  }

  const { events, ...rest }: Props = $props();

  const log = new EventLogState();
  let seen = 0;
  $effect(() => {
    const arrived = events.slice(seen);
    seen = events.length;
    untrack(() => {
      for (const entry of arrived) {
        log.add(`${entry.atom}: ${entry.event}`, {
          tone: entry.event === "disposed" ? "interrupted" : "success",
        });
      }
    });
  });
</script>

<EventLog
  empty="Nothing yet. Add a reader to an atom."
  entries={log.entries}
  label="Registry"
  max={8}
  {...rest}
/>
