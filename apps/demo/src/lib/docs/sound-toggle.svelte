<script lang="ts">
  import Volume2Icon from "@lucide/svelte/icons/volume-2";
  import VolumeXIcon from "@lucide/svelte/icons/volume-x";
  import { Button } from "#lib/components/ui/button/index.ts";
  import { play } from "#lib/docs/kit/sound.ts";
  import { isSoundOn, setSoundOn } from "#lib/docs/sound-preference.ts";
  import { onMount } from "svelte";

  // The server can't see localStorage, so this starts at the default and reads the stored choice
  // once mounted. The icon doesn't wait: app.html's inline script marks `<html data-sound="off">`
  // before first paint, and the style below shows the icon from that.
  let on = $state(true);
  onMount(() => {
    on = isSoundOn();
  });

  const toggle = () => {
    on = !on;
    setSoundOn(on);
    if (on) {
      // A chime confirms that sound works, as on effect.kitlangton.com. `play` is small; it loads
      // Tone.js now, inside this click, not with the header.
      play("success");
    }
  };
</script>

<!-- One label, with aria-pressed saying whether it is on, as a toggle button should. -->
<Button
  aria-label="Sound effects"
  aria-pressed={on}
  class="sound-toggle"
  onclick={toggle}
  size="icon-sm"
  title={on ? "Sound effects on" : "Sound effects off"}
  variant="ghost"
>
  <Volume2Icon class="sound-on-icon text-brand-text" />
  <VolumeXIcon class="sound-off-icon" />
</Button>

<style>
  :global(html:not([data-sound="off"]) .sound-toggle .sound-off-icon),
  :global(html[data-sound="off"] .sound-toggle .sound-on-icon) {
    display: none;
  }
</style>
