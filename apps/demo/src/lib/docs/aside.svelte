<script lang="ts">
  import InfoIcon from "@lucide/svelte/icons/info";
  import LightbulbIcon from "@lucide/svelte/icons/lightbulb";
  import OctagonAlertIcon from "@lucide/svelte/icons/octagon-alert";
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
  import type { Snippet } from "svelte";

  /** The four callouts of the Effect docs. */
  type AsideType = "note" | "tip" | "caution" | "danger";

  const {
    children,
    title,
    type = "note",
  }: { children: Snippet; title?: string; type?: AsideType } = $props();

  const kinds = {
    caution: { icon: TriangleAlertIcon, title: "Caution" },
    danger: { icon: OctagonAlertIcon, title: "Danger" },
    note: { icon: InfoIcon, title: "Note" },
    tip: { icon: LightbulbIcon, title: "Tip" },
  } as const;

  const kind = $derived(kinds[type]);
</script>

<!-- A note in the frame's voice: a square, faintly tinted panel ruled in hairlines, with a rule
     and a mono title in its kind's color. -->
<aside aria-label={title ?? kind.title} class="aside aside--{type}">
  <p aria-hidden="true" class="aside-title">
    <kind.icon class="size-4 -translate-y-px" strokeWidth={2.5} />
    {title ?? kind.title}
  </p>
  <div class="aside-content">
    {@render children()}
  </div>
</aside>

<style>
  .aside {
    border: 1px solid var(--border);
    border-left: 2px solid var(--aside-color);
    border-radius: var(--radius-md);
    margin-block: 1.5rem;
    padding: 1rem 1.25rem 0.25rem;
    position: relative;
  }
  .aside-title {
    align-items: center;
    color: var(--aside-color);
    display: flex;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 400;
    gap: 0.5rem;
    letter-spacing: 0.08em;
    line-height: 1.125rem;
    margin: 0;
    text-transform: uppercase;
  }
  .aside-content :global(> :first-child) {
    margin-top: 0.75rem;
  }
  .aside-content :global(> :last-child) {
    margin-bottom: 1rem;
  }
  /* Titles are darker in light mode, where the bright colors fail contrast on the tint. */
  .aside--note {
    --aside-color: #1d4ed8;
    background-color: #3b82f60d;
  }
  :global(.dark) .aside--note {
    --aside-color: #3b82f6;
  }
  .aside--tip {
    --aside-color: #047857;
    background-color: #10b9810d;
  }
  :global(.dark) .aside--tip {
    --aside-color: #10b981;
  }
  .aside--caution {
    --aside-color: #b45309;
    background-color: #f59e0b0d;
  }
  :global(.dark) .aside--caution {
    --aside-color: #f59e0b;
  }
  .aside--danger {
    --aside-color: #b91c1c;
    background-color: #ef44440d;
  }
  :global(.dark) .aside--danger {
    --aside-color: #ef4444;
  }
</style>
