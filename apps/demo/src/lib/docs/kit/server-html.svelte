<!--
  @component
  What an element said in the page's HTML, as the server sends it: next to a live value, it shows
  whether that value was in the server's markup or arrived in the browser. It fetches the page's
  HTML once (every ServerHtml on the page shares the request), finds the element by its
  `data-testid` and shows its text. On this site's prerendered pages, that HTML was rendered when
  the site was built. It shows "…" until the HTML arrives, including in the server's own render.

  ```svelte
  <div data-testid="width">{width.current}</div>
  <ServerHtml of="width" />
  ```

  It reads "In the HTML" before the text. Other attributes go on the `<output>`, whose text is the
  element's text with its whitespace collapsed, or "Not in the HTML".
-->
<script module lang="ts">
  let fetched: { readonly path: string; readonly html: Promise<Document | undefined> } | undefined;

  /** The page's HTML, parsed: what a request for it returns, before any script runs. */
  const pageHtml = (path: string) => {
    if (fetched?.path !== path) {
      const html = (async () => {
        try {
          const response = await fetch(path, { headers: { accept: "text/html" } });
          return new DOMParser().parseFromString(await response.text(), "text/html");
        } catch {
          return undefined;
        }
      })();
      fetched = { html, path };
    }
    return fetched.html;
  };
</script>

<script lang="ts">
  import FileCodeIcon from "@lucide/svelte/icons/file-code";
  import type { HTMLOutputAttributes } from "svelte/elements";

  interface Props extends HTMLOutputAttributes {
    /** The `data-testid` of the element to look up. */
    readonly of: string;
  }

  const { of, ...rest }: Props = $props();

  let text = $state<string>();

  $effect(() => {
    let live = true;
    void (async () => {
      const html = await pageHtml(location.pathname);
      if (!live) {
        return;
      }
      if (!html) {
        text = "Couldn't load the HTML";
        return;
      }
      const element = html.querySelector(`[data-testid="${of}"]`);
      text = element?.textContent?.replaceAll(/\s+/gu, " ").trim() ?? "Not in the HTML";
    })();
    return () => {
      live = false;
    };
  });
</script>

<span class="server-html not-prose">
  <FileCodeIcon aria-hidden="true" class="icon" />
  <span class="tag">In the HTML</span>
  <output {...rest}>{text ?? "…"}</output>
</span>

<style>
  .server-html {
    align-items: center;
    background: var(--muted);
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    color: var(--muted-foreground);
    display: inline-flex;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    gap: 0.35rem;
    padding: 0.15rem 0.5rem;
    white-space: nowrap;
  }
  .tag {
    font-family: var(--font-sans);
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .server-html output {
    background: none;
    color: var(--foreground);
    font-size: inherit;
    padding: 0;
  }
  .server-html :global(.icon) {
    flex: none;
    height: 0.85rem;
    width: 0.85rem;
  }
</style>
