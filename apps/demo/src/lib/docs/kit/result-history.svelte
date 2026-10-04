<!--
  @component
  An `EventLog` of the states an `AsyncResult` has been through, timed from when the example
  mounted: "Initial, waiting" at 0 ms, "Success 4" at 604 ms, "Success 4, waiting" when a refresh
  starts, and so on. It makes `waiting` and the order of states visible without any logging code in
  the example. Use it where the sequence of states is what the example teaches.

  ```svelte
  <ResultHistory data-testid="die-history" result={die.current} />
  ```
-->
<script lang="ts">
  import type { AsyncResult } from "effect/reactivity";
  import type { HTMLAttributes } from "svelte/elements";

  import EventLog from "./event-log.svelte";
  import { EventLogState } from "./event-log.svelte.ts";
  import { toneOf } from "./tone.ts";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    /** Turns a success value into text; `String` by default. */
    readonly format?: (value: unknown) => string;
    /** The caption; "History" by default. */
    readonly label?: string;
    /** How many recent states to show; 6 by default. */
    readonly max?: number;
    readonly result: AsyncResult.AsyncResult<unknown, unknown>;
  }

  const { format = String, label = "History", max = 6, result, ...rest }: Props = $props();

  const log = new EventLogState({ limit: 20 });

  const describe = (current: AsyncResult.AsyncResult<unknown, unknown>) => {
    const value = current._tag === "Success" ? ` ${format(current.value)}` : "";
    return `${current._tag}${value}${current.waiting ? ", waiting" : ""}`;
  };

  let last: string | undefined;
  $effect(() => {
    const text = describe(result);
    if (text !== last) {
      last = text;
      log.add(text, { tone: result.waiting ? "running" : toneOf(result) });
    }
  });
</script>

<EventLog entries={log.entries} {label} {max} {...rest} />
