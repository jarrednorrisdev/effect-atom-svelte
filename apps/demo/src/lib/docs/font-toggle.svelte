<script lang="ts">
  import { Button } from "#lib/components/ui/button/index.ts";
  import { currentFont, setFont } from "#lib/docs/font-preference.ts";
  import type { Font } from "#lib/docs/font-preference.ts";
  import { onMount } from "svelte";

  // The server can't see localStorage, so this starts at the default and reads the page's font
  // once mounted. The glyph doesn't wait: it is set in the page's own font, which app.html's
  // inline script picks before first paint.
  let font = $state<Font>("inter");
  onMount(() => {
    font = currentFont();
  });

  const toggle = () => {
    font = font === "inter" ? "libron" : "inter";
    setFont(font);
  };
</script>

<!-- One label, with aria-pressed saying whether Libron is on, as a toggle button should. -->
<Button
  aria-label="Use Libron font"
  aria-pressed={font === "libron"}
  class="text-base font-normal"
  onclick={toggle}
  size="icon-sm"
  title={font === "inter" ? "Font: Inter (switch to Libron)" : "Font: Libron (switch to Inter)"}
  variant="ghost"
>
  <span aria-hidden="true">Aa</span>
</Button>
