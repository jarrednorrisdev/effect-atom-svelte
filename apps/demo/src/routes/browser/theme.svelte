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
  <select aria-label="Theme" bind:value={theme.current} data-testid="theme">
    <option value="light">Light</option>
    <option value="dark">Dark</option>
  </select>
  <button data-cue="none" onclick={() => location.reload()}>Reload the page</button>
  <p>The {theme.current} theme, read from the pref-theme cookie.</p>
</div>

