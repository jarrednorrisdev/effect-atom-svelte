<!--
  @component
  One row of a comparison between the server's HTML and the page now: a short label from the code
  (how the atom is read), what the page's HTML has in that place (`ServerHtml`), and the live
  content. Stack a few to show which reads make it into the server's markup and which the browser
  fills in.

  ```svelte
  <ServerRow id="waits-script" read="await useAtomResult">
    <Origin where={script.current.value} />
  </ServerRow>
  ```

  The live content is wrapped in an element with `data-testid={id}`, and the HTML's text is an
  `<output>` with `data-testid="{id}-html"`. The two wrap under each other when the row is narrow,
  and on a phone the label goes above them.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  import ServerHtml from "./server-html.svelte";

  interface Props {
    readonly children: Snippet;
    /** The `data-testid` of the live cell, which ServerHtml looks up in the HTML. */
    readonly id: string;
    /** How the example reads the atom, shown as code. */
    readonly read: string;
  }

  const { children, id, read }: Props = $props();
</script>

<div class="row not-prose">
  <code class="read">{read}</code>
  <span class="cells">
    <ServerHtml data-testid="{id}-html" of={id} />
    <span class="live" data-testid={id}>{@render children()}</span>
  </span>
</div>

<style>
  .row {
    align-items: center;
    border-bottom: 1px solid var(--border);
    display: grid;
    gap: 0.5rem 1rem;
    grid-template-columns: 13rem 1fr;
    padding: 0.5rem 0;
  }
  .read {
    font-size: 0.8rem;
  }
  .cells {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
  }
  .live {
    align-items: center;
    display: inline-flex;
  }
  @media (width < 40rem) {
    .row {
      grid-template-columns: 1fr;
    }
  }
</style>
