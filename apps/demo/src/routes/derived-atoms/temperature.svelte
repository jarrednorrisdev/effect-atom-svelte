<script module lang="ts">
  import { Atom } from "effect/reactivity";

  const celsiusAtom = Atom.make(20);

  // Read-only: computed again when celsiusAtom changes.
  const feelAtom = Atom.make((get) => {
    const celsius = get(celsiusAtom);
    if (celsius < 10) {
      return "cold";
    }
    return celsius < 25 ? "mild" : "hot";
  });

  // Writable: reads from celsiusAtom, and writes back to it.
  const fahrenheitAtom = Atom.writable(
    (get) => (get(celsiusAtom) * 9) / 5 + 32,
    (ctx, fahrenheit: number) => ctx.set(celsiusAtom, ((fahrenheit - 32) * 5) / 9)
  );
</script>

<script lang="ts">
  import { useAtom, useAtomValue } from "effect-atom-svelte";
  import Arrow from "#lib/docs/kit/arrow.svelte";
  import FlashValue from "#lib/docs/kit/flash-value.svelte";
  import Part from "#lib/docs/kit/part.svelte";

  const celsius = useAtom(celsiusAtom);
  const fahrenheit = useAtom(fahrenheitAtom);
  const feel = useAtomValue(feelAtom);
</script>

<div class="flex flex-wrap gap-3">
  <Part code label="fahrenheitAtom">
    <label>
      °F
      <input
        bind:value={fahrenheit.current}
        class="w-24"
        data-testid="fahrenheit"
        type="number"
      />
    </label>
  </Part>
  <Arrow both label="get, set" pulse={celsius.current} />
  <Part code label="celsiusAtom">
    <label>
      °C
      <input
        bind:value={celsius.current}
        class="w-24"
        data-testid="celsius"
        type="number"
      />
    </label>
  </Part>
  <Arrow label="get" pulse={celsius.current} />
  <Part code label="feelAtom">
    It feels <FlashValue data-testid="feel" value={feel.current} />.
  </Part>
</div>
