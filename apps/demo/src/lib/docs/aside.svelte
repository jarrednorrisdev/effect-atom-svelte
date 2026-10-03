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

<!-- effect.website's asides: a tinted panel with a coloured title. -->
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
    border-radius: 0.375rem;
    margin-block: 1.5rem;
    padding: 1.12rem 1.125rem 0.25rem;
    position: relative;
  }
  .aside::before {
    border: 2px solid #ffffffe6;
    border-radius: inherit;
    content: "";
    inset: 0;
    mix-blend-mode: overlay;
    pointer-events: none;
    position: absolute;
  }
  .aside-title {
    align-items: center;
    display: flex;
    font-size: 1rem;
    font-weight: 600;
    gap: 0.5rem;
    line-height: 1.125rem;
    margin: 0;
  }
  .aside-content :global(> :first-child) {
    margin-top: 0.75rem;
  }
  .aside-content :global(> :last-child) {
    margin-bottom: 1rem;
  }
  .aside--note {
    background-color: #3b82f614;
    & .aside-title {
      color: #3b82f6;
    }
  }
  .aside--tip {
    background-color: #10b98114;
    & .aside-title {
      color: #10b981;
    }
  }
  .aside--caution {
    background-color: #f59e0b14;
    & .aside-title {
      color: #f59e0b;
    }
  }
  .aside--danger {
    background-color: #ef444414;
    & .aside-title {
      color: #ef4444;
    }
  }
</style>
