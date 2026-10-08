<script lang="ts">
  import MonitorIcon from "@lucide/svelte/icons/monitor";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import SunIcon from "@lucide/svelte/icons/sun";
  import { useAtom, useAtomValue } from "effect-atom-svelte";
  import { Button } from "#lib/components/ui/button/index.ts";
  import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.ts";
  import { applyTheme, themeAtom, themeChoiceAtom, themeChoices } from "#lib/docs/theme.ts";
  import type { ThemeChoice } from "#lib/docs/theme.ts";

  const choice = useAtom(themeChoiceAtom);
  const theme = useAtomValue(themeAtom);

  // The server renders the default, so this also corrects the page once the browser has read the
  // stored choice; app.html's inline script has usually got there first.
  $effect(() => applyTheme(choice.current, theme.current));

  const options = [
    { icon: MoonIcon, label: "Dark", value: "dark" },
    { icon: SunIcon, label: "Light", value: "light" },
    { icon: MonitorIcon, label: "System", value: "system" },
  ] as const;

  const isChoice = (value: string): value is ThemeChoice =>
    (themeChoices as readonly string[]).includes(value);
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} aria-label="Theme" class="theme-toggle" size="icon-sm" variant="ghost">
        <!-- The icon follows <html data-theme>, which app.html sets before first paint. -->
        <MoonIcon class="theme-dark-icon" />
        <SunIcon class="theme-light-icon" />
        <MonitorIcon class="theme-system-icon" />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <!-- Kept clear of the window's edge, which its cell in the header touches. -->
  <DropdownMenu.Content align="end" class="w-36" collisionPadding={8}>
    <DropdownMenu.RadioGroup
      bind:value={
        () => choice.current,
        (value) => {
          if (isChoice(value)) {
            choice.current = value;
          }
        }
      }
    >
      {#each options as option (option.value)}
        <!-- The current choice's check is in the accent. -->
        <DropdownMenu.RadioItem
          class="data-[state=checked]:font-medium [&_[data-slot=dropdown-menu-radio-item-indicator]_svg]:text-brand-text!"
          closeOnSelect
          value={option.value}
        >
          <option.icon class="theme-icon theme-{option.value}-icon" />
          {option.label}
        </DropdownMenu.RadioItem>
      {/each}
    </DropdownMenu.RadioGroup>
  </DropdownMenu.Content>
</DropdownMenu.Root>

<style>
  /* The same colors in the menu as on the button: sky for the moon, the accent for the sun. The
     menu item's focus style recolors everything inside it, the icons' shapes included, so these
     are more specific. */
  :global([data-slot="dropdown-menu-radio-item"] svg.theme-icon.theme-dark-icon),
  :global([data-slot="dropdown-menu-radio-item"] svg.theme-icon.theme-dark-icon *),
  :global(.theme-toggle .theme-dark-icon) {
    color: var(--color-sky-400) !important;
  }
  :global([data-slot="dropdown-menu-radio-item"] svg.theme-icon.theme-light-icon),
  :global([data-slot="dropdown-menu-radio-item"] svg.theme-icon.theme-light-icon *),
  :global(.theme-toggle .theme-light-icon) {
    color: var(--brand) !important;
  }
  :global([data-slot="dropdown-menu-radio-item"] svg.theme-icon.theme-system-icon),
  :global([data-slot="dropdown-menu-radio-item"] svg.theme-icon.theme-system-icon *) {
    color: var(--muted-foreground) !important;
  }
  :global(.theme-toggle svg) {
    display: none;
  }
  :global(html[data-theme="dark"] .theme-toggle .theme-dark-icon),
  :global(html[data-theme="light"] .theme-toggle .theme-light-icon),
  :global(html[data-theme="system"] .theme-toggle .theme-system-icon) {
    display: block;
  }
</style>
