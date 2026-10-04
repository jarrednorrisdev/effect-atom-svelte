<!--
  @component
  The install command, in a tab for each package manager. The reader's choice is kept in
  localStorage by an atom, so the next visit opens on the same tab. Bun is the default.

  ```svelte
  <InstallCommand />
  ```
-->
<script module lang="ts">
  import { Schema } from "effect";
  import { KeyValueStore } from "effect/persistence";
  import { Atom } from "effect/reactivity";

  import { browser } from "$app/env";

  const managers = ["bun", "pnpm", "npm"] as const;

  // localStorage only exists in the browser; the server renders the default.
  const storage = Atom.runtime(
    browser
      ? KeyValueStore.layerStorage(() => localStorage)
      : KeyValueStore.layerMemory
  );

  const packageManagerAtom = Atom.kvs({
    defaultValue: (): (typeof managers)[number] => "bun",
    key: "package-manager",
    runtime: storage,
    schema: Schema.Literals(managers),
  });
</script>

<script lang="ts">
  import { useAtom } from "effect-atom-svelte";

  import * as Tabs from "#lib/components/ui/tabs/index.ts";

  import bun from "./install/bun.bash?highlight";
  import npm from "./install/npm.bash?highlight";
  import pnpm from "./install/pnpm.bash?highlight";

  const commands = { bun, npm, pnpm };
  const manager = useAtom(packageManagerAtom);
</script>

<figure class="install-command">
  <div class="not-prose flex items-end overflow-x-auto rounded-t-lg border bg-muted/40">
    <Tabs.Root bind:value={manager.current}>
      <Tabs.List aria-label="Package manager" class="h-auto w-max gap-0 p-0" variant="line">
        {#each managers as name (name)}
          <Tabs.Trigger class="example-tab after:hidden" value={name}>{name}</Tabs.Trigger>
        {/each}
      </Tabs.List>
    </Tabs.Root>
  </div>
  <!-- All three are rendered and the others hidden: hydration keeps the server's {@html}, so
       swapping one block's HTML would not show a choice stored in the browser. Highlighted at
       build time by vite/highlight.ts, copy button included. -->
  {#each managers as name (name)}
    <div hidden={manager.current !== name} role="tabpanel">{@html commands[name]}</div>
  {/each}
</figure>

<style>
  .install-command {
    margin-block: 1.5rem;
  }
  /* The tabs sit on top of the code block, as on an example's files. */
  .install-command :global(.code-block) {
    margin: 0;
  }
  .install-command :global(.shiki) {
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    border-top: 0;
    margin: 0;
  }
</style>
