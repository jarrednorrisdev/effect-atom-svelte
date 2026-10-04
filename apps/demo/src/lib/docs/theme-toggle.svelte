<script lang="ts">
  import MoonIcon from "@lucide/svelte/icons/moon";
  import SunIcon from "@lucide/svelte/icons/sun";
  import { Button } from "#lib/components/ui/button/index.ts";
  import { followSystemTheme, toggleTheme } from "#lib/docs/theme.ts";

  $effect(followSystemTheme);
</script>

<!-- The icon follows the `dark` class, so it is right before hydration without any state. -->
<Button aria-label="Toggle theme" onclick={toggleTheme} size="icon-sm" variant="ghost">
  <SunIcon class="text-brand dark:hidden" />
  <MoonIcon class="hidden text-sky-400 dark:block" />
</Button>
