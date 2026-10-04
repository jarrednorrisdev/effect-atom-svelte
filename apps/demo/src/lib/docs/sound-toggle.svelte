<script lang="ts">
  import Volume2Icon from "@lucide/svelte/icons/volume-2";
  import VolumeXIcon from "@lucide/svelte/icons/volume-x";
  import { Button } from "#lib/components/ui/button/index.ts";
  import { isSoundOn, setSoundOn } from "#lib/docs/sound-preference.ts";
  import { onMount } from "svelte";

  // The server can't see localStorage, so this starts at the default and reads the stored choice
  // once mounted.
  let on = $state(true);
  onMount(() => {
    on = isSoundOn();
  });

  const toggle = async () => {
    on = !on;
    setSoundOn(on);
    if (on) {
      // A cue confirms that sound works. The synthesizer loads now, not with the header.
      const { play } = await import("#lib/docs/kit/sound.ts");
      play("tap");
    }
  };
</script>

<!-- One label, with aria-pressed saying whether it is on, as a toggle button should. -->
<Button
  aria-label="Sound effects"
  aria-pressed={on}
  onclick={toggle}
  size="icon-sm"
  title={on ? "Sound effects on" : "Sound effects off"}
  variant="ghost"
>
  {#if on}
    <Volume2Icon />
  {:else}
    <VolumeXIcon />
  {/if}
</Button>
