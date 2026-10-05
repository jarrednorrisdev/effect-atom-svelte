<script module lang="ts">
  import { Schema } from "effect";
  import { Atom } from "effect/reactivity";

  import { cookieStorage } from "#lib/preferences.ts";

  // Stored in a cookie, which the browser sends with every request.
  const themeAtom = Atom.kvs({
    defaultValue: () => "light" as const,
    key: "pref-theme",
    runtime: cookieStorage,
    schema: Schema.Literals(["light", "dark"]),
  });
</script>

<script lang="ts">
  import { useAtom } from "effect-atom-svelte";
  // What the server's HTML had in the same place.
  import ServerHtml from "#lib/docs/kit/server-html.svelte";

  const theme = useAtom(themeAtom);
</script>

<div
  class={[
    "rounded-md p-3",
    theme.current === "dark" ? "bg-zinc-900 text-zinc-50" : "bg-zinc-50 text-zinc-900",
  ]}
  data-testid="themed"
  data-theme={theme.current}
>
  <p class="m-0 flex flex-wrap items-center gap-2">
    <span aria-label="Theme" class="flex gap-2" role="group">
      {#each ["light", "dark"] as const as name (name)}
        <button aria-pressed={theme.current === name} onclick={() => (theme.current = name)}>
          {name}
        </button>
      {/each}
    </span>
    <button data-cue="none" onclick={() => location.reload()}>Reload the page</button>
  </p>
  <p class="mb-0 flex flex-wrap items-center gap-2">
    The <strong data-testid="theme-name">{theme.current}</strong> theme, read from the
    pref-theme cookie.
    <ServerHtml of="theme-name" />
  </p>
</div>

