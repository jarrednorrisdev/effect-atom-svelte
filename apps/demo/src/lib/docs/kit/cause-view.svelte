<!--
  @component
  A `Cause` taken apart, one row per reason, so the three ways an effect can end without a value
  look different at a glance: a typed error (`Fail`, in the error type) is a red tint with an alert
  icon, a defect (`Die`, not in the type, usually a bug) is striped with a bug icon, and an
  interruption (`Interrupt`) is gray and dashed. Rows slide in when the cause changes (Motion).
  Pass `undefined` while there is no failure, and it says so.

  ```svelte
  <CauseView cause={todo.current._tag === "Failure" ? todo.current.cause : undefined} />
  ```

  Each row is an `<li>` with `data-reason` (`Fail`, `Die`, `Interrupt`). Other attributes go on
  the wrapper.
-->
<script lang="ts">
  import AlertIcon from "@lucide/svelte/icons/circle-alert";
  import BugIcon from "@lucide/svelte/icons/bug";
  import StopIcon from "@lucide/svelte/icons/octagon-x";
  import { Cause } from "effect";
  import type { HTMLAttributes } from "svelte/elements";

  import { enter } from "./motion.ts";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    readonly cause: Cause.Cause<unknown> | undefined;
    /** Shows the caption as code, in its own case (`hashAtom`), as `Part` does. */
    readonly code?: boolean;
    /** The caption; "Cause" by default. */
    readonly label?: string;
  }

  const { cause, code = false, label = "Cause", ...rest }: Props = $props();

  /**
   * A tagged error with a message as `SchemaError: Expected …`, one without as
   * `NotFound { id: 99 }`, anything else as its string.
   */
  const show = (value: unknown): string => {
    if (typeof value !== "object" || value === null || !("_tag" in value)) {
      return String(value);
    }
    if ("message" in value && typeof value.message === "string" && value.message !== "") {
      return `${String(value._tag)}: ${value.message}`;
    }
    const fields = Object.entries(value).filter(([key]) => key !== "_tag");
    const body = fields.map(([key, field]) => `${key}: ${JSON.stringify(field)}`);
    return body.length > 0 ? `${value._tag} { ${body.join(", ")} }` : String(value._tag);
  };

  interface Row {
    readonly kind: string;
    readonly reason: "Die" | "Fail" | "Interrupt";
    readonly text: string;
  }

  const rows = $derived(
    (cause?.reasons ?? []).map((reason): Row => {
      if (Cause.isFailReason(reason)) {
        return { kind: "typed error", reason: "Fail", text: show(reason.error) };
      }
      if (Cause.isDieReason(reason)) {
        return { kind: "defect", reason: "Die", text: show(reason.defect) };
      }
      const fiber = reason.fiberId === undefined ? "" : ` by fiber #${reason.fiberId}`;
      return { kind: "interruption", reason: "Interrupt", text: `interrupted${fiber}` };
    })
  );

  // A new cause gets new keys, so its rows slide in.
  let generation = 0;
  const keyed = $derived.by(() => {
    generation += 1;
    return rows.map((row, index) => ({ ...row, key: `${generation}-${index}` }));
  });
  const id = $props.id();
</script>

<div class="cause not-prose" {...rest}>
  <p class={["caption", code && "code"]} id="{id}-label">{label}</p>
  {#if keyed.length === 0}
    <p class="empty">No failure, so no cause.</p>
  {:else}
    <ul aria-labelledby="{id}-label">
      {#each keyed as row (row.key)}
        <li data-reason={row.reason} {@attach enter({ opacity: [0, 1], x: [-8, 0] })}>
          <span class="tag">
            {#if row.reason === "Fail"}
              <AlertIcon aria-hidden="true" class="icon" />
            {:else if row.reason === "Die"}
              <BugIcon aria-hidden="true" class="icon" />
            {:else}
              <StopIcon aria-hidden="true" class="icon" />
            {/if}
            {row.reason}
          </span>
          <span class="text">{row.text}</span>
          <span class="kind">
            {row.kind}, {row.reason === "Fail" ? "in the error type" : "not in the type"}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .cause {
    margin-top: 0.75rem;
  }
  .caption {
    color: var(--muted-foreground);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.06em;
    margin: 0 0 0.4rem;
    text-transform: uppercase;
  }
  .caption.code {
    font-family: var(--font-mono);
    letter-spacing: normal;
    text-transform: none;
  }
  .empty {
    border: 1.5px dashed var(--border-strong);
    border-radius: var(--radius-lg);
    color: var(--muted-foreground);
    font-size: 0.8rem;
    margin: 0;
    padding: 0.5rem 0.75rem;
  }
  ul {
    display: grid;
    gap: 0.4rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    --mark: var(--tone-failure);
    --text: var(--tone-failure-text);
    align-items: center;
    background: color-mix(in oklab, var(--mark) 10%, var(--background));
    border: 1.5px solid color-mix(in oklab, var(--mark) 70%, transparent);
    border-radius: var(--radius-lg);
    column-gap: 0.75rem;
    display: grid;
    font-size: 0.8rem;
    grid-template-columns: auto 1fr;
    padding: 0.45rem 0.75rem;
    row-gap: 0.15rem;
  }
  /* A defect is a bug: hazard stripes, so it never reads as an expected error. */
  li[data-reason="Die"] {
    background: repeating-linear-gradient(
      -45deg,
      color-mix(in oklab, var(--mark) 16%, var(--background)) 0 0.5rem,
      color-mix(in oklab, var(--mark) 6%, var(--background)) 0.5rem 1rem
    );
    border-width: 2px;
  }
  li[data-reason="Interrupt"] {
    --mark: var(--tone-interrupted);
    --text: var(--tone-interrupted-text);
    border-style: dashed;
  }
  .tag {
    align-items: center;
    color: var(--text);
    display: inline-flex;
    font-family: var(--font-mono);
    font-weight: 700;
    gap: 0.35rem;
    grid-row: span 2;
  }
  .tag :global(.icon) {
    height: 1rem;
    width: 1rem;
  }
  .text {
    white-space: pre-wrap;
    color: var(--foreground);
    font-family: var(--font-mono);
    overflow-wrap: anywhere;
  }
  .kind {
    color: var(--text);
    font-size: 0.75rem;
  }
</style>
