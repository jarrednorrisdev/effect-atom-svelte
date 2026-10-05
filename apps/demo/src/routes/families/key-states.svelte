<!--
  Shows where each of a family's drafts is: read by the editor, waiting out its idle TTL, kept,
  or disposed. Not part of the example's code: it checks the registry from outside, every
  100 ms, so it never holds an atom itself. The countdown is its own clock, started when you
  leave a key; the registry decides when the atom actually goes.
-->
<script lang="ts">
  import type { Atom } from "effect/reactivity";
  import { getRegistry } from "effect-atom-svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { SvelteMap } from "svelte/reactivity";

  interface Key {
    readonly doc: number;
    readonly lang: string;
  }

  interface Props extends HTMLAttributes<HTMLUListElement> {
    readonly current: Key;
    readonly family: (key: Key) => Atom.Atom<string>;
    /** The idle TTL in milliseconds: 0 for none, Infinity for keepAlive. */
    readonly ttl: number;
  }

  const { current, family, ttl, ...rest }: Props = $props();

  const keys: readonly Key[] = [
    { doc: 1, lang: "en" },
    { doc: 1, lang: "fr" },
    { doc: 2, lang: "en" },
    { doc: 2, lang: "fr" },
  ];
  const name = (key: Key) => `${key.doc} ${key.lang}`;

  const registry = getRegistry();
  let now = $state(Date.now());
  let live = $state<readonly string[]>([]);

  const scan = () => {
    now = Date.now();
    const nodes = registry.getNodes();
    const found = keys.filter((key) => nodes.has(family(key))).map(name);
    if (found.join(",") !== live.join(",")) {
      live = found;
    }
  };

  $effect(() => {
    scan();
    const timer = setInterval(scan, 100);
    return () => clearInterval(timer);
  });

  // When each key was last left.
  const leftAt = new SvelteMap<string, number>();
  let previous: string | undefined;
  $effect(() => {
    const next = name(current);
    if (previous !== undefined && previous !== next) {
      leftAt.set(previous, Date.now());
    }
    previous = next;
  });

  const describe = (key: Key) => {
    const id = name(key);
    if (id === name(current)) {
      return { text: "read by the editor", tone: "success" };
    }
    if (!live.includes(id)) {
      return leftAt.has(id)
        ? { text: "disposed", tone: "gone" }
        : { text: "not made yet", tone: "none" };
    }
    if (ttl === Number.POSITIVE_INFINITY) {
      return { text: "kept, no reader", tone: "idle" };
    }
    const left = Math.max(0, ttl - (now - (leftAt.get(id) ?? now)));
    return { text: `no reader, ${Math.ceil(left / 1000)}s left`, tone: "running" };
  };
</script>

<ul class="states not-prose" {...rest}>
  {#each keys as key (name(key))}
    {@const { text, tone } = describe(key)}
    <li data-key={name(key)} data-tone={tone}>
      <code>&#123; doc: {key.doc}, lang: "{key.lang}" &#125;</code>
      <span>{text}</span>
    </li>
  {/each}
</ul>

<style>
  .states {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    list-style: none;
    margin: 0.75rem 0 0;
    padding: 0;
  }
  li {
    --mark: var(--tone-idle);
    align-items: baseline;
    border: 1px solid color-mix(in oklab, var(--mark) 60%, transparent);
    border-radius: var(--radius-sm);
    display: flex;
    flex-wrap: wrap;
    font-size: 0.75rem;
    gap: 0 0.5rem;
    justify-content: space-between;
    padding: 0.15rem 0.45rem;
    transition:
      border-color 200ms,
      opacity 200ms;
  }
  li span {
    color: var(--muted-foreground);
  }
  li[data-tone="success"] {
    --mark: var(--tone-success);
  }
  li[data-tone="running"] {
    --mark: var(--tone-running);
  }
  li[data-tone="running"] span {
    color: var(--tone-running-text);
  }
  li[data-tone="gone"] {
    --mark: var(--tone-failure);
    border-style: dashed;
  }
  li[data-tone="gone"] span {
    color: var(--tone-failure-text);
  }
  li[data-tone="none"] {
    border-style: dashed;
    opacity: 0.55;
  }
</style>
