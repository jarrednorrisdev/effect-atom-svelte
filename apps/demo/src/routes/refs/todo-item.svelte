<script lang="ts">
  import type { AtomRef } from "effect/reactivity";
  import { useAtomRefPropValue } from "effect-atom-svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";

  interface Todo {
    readonly done: boolean;
    readonly title: string;
  }

  const { item, onremove }: { item: AtomRef.AtomRef<Todo>; onremove: () => void } =
    $props();

  const title = useAtomRefPropValue(() => item, "title");
  const done = useAtomRefPropValue(() => item, "done");

  // Counts this item's notifications.
  let notified = $state(0);
  $effect(() => item.subscribe(() => (notified += 1)));
</script>

<li class="flex flex-wrap items-center gap-2">
  <label class="min-w-32 whitespace-nowrap">
    <input
      checked={done.current}
      onchange={(event) => item.prop("done").set(event.currentTarget.checked)}
      type="checkbox"
    />
    {title.current}
  </label>
  <FlashValue aria-label="{title.current} notifications" value={notified} />
  <button aria-label="Remove {title.current}" onclick={onremove}>Remove</button>
</li>
