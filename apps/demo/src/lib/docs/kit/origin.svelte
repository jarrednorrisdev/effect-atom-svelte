<!--
  @component
  Where a value was computed, for the server rendering examples: a server icon and "Computed on
  the server", or a monitor icon and "Computed in the browser". Pass the value of an atom that
  records where it ran (`"server"` or `"browser"`); anything else, such as no value yet, reads
  "Not computed yet". It flashes when it changes, as a hydrated value replaced by the browser's
  does. On this site's prerendered pages, "the server" is the build.

  ```svelte
  {#if where.current._tag === "Success"}
    <Origin data-testid="where" where={where.current.value} />
  {/if}
  ```

  Other attributes go on the `<output>`, whose text is exactly one of the three phrases.
-->
<script lang="ts">
  import CircleDashedIcon from "@lucide/svelte/icons/circle-dashed";
  import MonitorIcon from "@lucide/svelte/icons/monitor";
  import ServerIcon from "@lucide/svelte/icons/server";
  import { animate } from "motion";
  import type { HTMLOutputAttributes } from "svelte/elements";

  import { onChange, reducedMotion, springs } from "./motion.ts";

  interface Props extends HTMLOutputAttributes {
    /** `"server"` or `"browser"`; anything else is not computed yet. */
    readonly where: string | undefined;
  }

  const { class: className, where, ...rest }: Props = $props();

  const flash = onChange(
    () => where,
    (element) => {
      animate(element, { "--flash": [1, 0] }, { duration: 1.2, ease: "easeOut" });
      if (!reducedMotion()) {
        animate(element, { scale: [0.94, 1] }, springs.bouncy);
      }
    }
  );
</script>

<output class={["origin not-prose", className]} data-where={where} {...rest} {@attach flash}>
  {#if where === "server"}
    <ServerIcon aria-hidden="true" class="icon" />
    Computed on the server
  {:else if where === "browser"}
    <MonitorIcon aria-hidden="true" class="icon" />
    Computed in the browser
  {:else}
    <CircleDashedIcon aria-hidden="true" class="icon" />
    Not computed yet
  {/if}
</output>

<style>
  .origin {
    --flash: 0;
    --mark: var(--tone-idle);
    --text: var(--tone-idle-text);
    align-items: center;
    /* --flash (0 to 1, animated) brightens the tint when the value changes. */
    background: color-mix(in oklab, var(--mark) calc(10% + var(--flash) * 35%), var(--background));
    border: 1.5px solid color-mix(in oklab, var(--mark) 60%, transparent);
    border-radius: 999px;
    color: var(--text);
    display: inline-flex;
    font-family: var(--font-sans);
    font-size: 0.8rem;
    font-weight: 600;
    gap: 0.35rem;
    padding: 0.15rem 0.65rem;
    white-space: nowrap;
  }
  .origin[data-where="server"] {
    --mark: var(--tone-success);
    --text: var(--tone-success-text);
  }
  .origin[data-where="browser"] {
    --mark: var(--tone-running);
    --text: var(--tone-running-text);
  }
  .origin :global(.icon) {
    flex: none;
    height: 0.9rem;
    width: 0.9rem;
  }
</style>
