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

  const celsius = useAtom(celsiusAtom);
  const fahrenheit = useAtom(fahrenheitAtom);
  const feel = useAtomValue(feelAtom);
</script>

<p>
  <label>
    °C <input bind:value={celsius.current} data-testid="celsius" type="number" />
  </label>
  <label>
    °F <input bind:value={fahrenheit.current} data-testid="fahrenheit" type="number" />
  </label>
</p>
<p>It feels <output data-testid="feel">{feel.current}</output>.</p>
