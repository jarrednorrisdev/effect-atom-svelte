<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  // The window's width. The server has no window, so it reads 1024 instead.
  const widthAtom = Atom.make((get) => {
    const update = () => get.setSelf(window.innerWidth);
    window.addEventListener("resize", update);
    get.addFinalizer(() => window.removeEventListener("resize", update));
    return window.innerWidth;
  }).pipe(Atom.withServerValue(() => 1024));

  // How much this site may store in the browser. The server reads it as Initial.
  const quotaAtom = Atom.make(
    Effect.promise(() => navigator.storage.estimate()).pipe(
      Effect.map(({ quota = 0 }) => `${(quota / 1e9).toFixed(1)} GB`)
    )
  ).pipe(Atom.withServerValueInitial);
</script>

<script lang="ts">
  import { useAtomResult, useAtomValue } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import ServerHtml from "#lib/docs/kit/server-html.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const width = useAtomValue(widthAtom);
  const quota = await useAtomResult(quotaAtom);
</script>

<p class="flex flex-wrap items-center gap-2">
  Width:
  <span data-testid="width"><FlashValue value={width.current} /> px</span>
  <ServerHtml data-testid="width-html" of="width" />
</p>
<p class="flex flex-wrap items-center gap-2">
  Storage quota:
  <span data-testid="quota">
    {#if quota.current._tag === "Success"}
      <output>{quota.current.value}</output>
    {:else}
      <StateBadge result={quota.current} />
    {/if}
  </span>
  <ServerHtml data-testid="quota-html" of="quota" />
</p>
