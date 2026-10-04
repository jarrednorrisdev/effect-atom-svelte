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
    /** Shows the caption as code, in its own case, such as an atom's name. */
    readonly code?: boolean;
    readonly events: readonly { readonly atom: string; readonly event: string }[];
    /** Shown while the log is empty. */
    readonly empty?: string;
    /** The log's caption; "Registry" by default. */
    readonly label?: string;
  }

  const {
    code = false,
    empty = "Nothing yet. Add a reader to an atom.",
    events,
    label = "Registry",
    ...rest
  }: Props = $props();

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
  {code}
  {empty}
  entries={log.entries}
  {label}
  max={8}
  {...rest}
/>
