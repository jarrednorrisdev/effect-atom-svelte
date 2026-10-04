<script module lang="ts">
  import { Atom } from "effect/reactivity";

  // Holds the value. The other two atoms are computed from it.
  const celsiusAtom = Atom.make(20);

  // Read-only: computed again when celsiusAtom changes.
  const feelAtom = Atom.make((get) => {
    const celsius = get(celsiusAtom);
    if (celsius < 10) {
      return "cold";
    }
    return celsius < 25 ? "mild" : "hot";
  });

  // Writable, but holds nothing: it reads celsiusAtom, and a write converts the
  // value and sets celsiusAtom.
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
  import Stepper from "#lib/docs/kit/stepper.svelte";

  const celsius = useAtom(celsiusAtom);
  const fahrenheit = useAtom(fahrenheitAtom);
  const feel = useAtomValue(feelAtom);
</script>

<div class="flex flex-col gap-3 sm:flex-row">
  <div class="sm:self-center">
    <Part code label="celsiusAtom">
      <Stepper bind:value={celsius.current} data-testid="celsius" label="Celsius" />
      <p class="mt-2 text-xs text-muted-foreground">Holds the value, in °C.</p>
    </Part>
  </div>
  <div class="grid flex-1 grid-cols-[2.5rem_1fr] gap-3 sm:grid-cols-[4.5rem_1fr]">
    <span class="flex justify-center">
      <Arrow both label="get, set" pulse={celsius.current} />
    </span>
    <Part code label="fahrenheitAtom">
      <Stepper
        bind:value={fahrenheit.current}
        data-testid="fahrenheit"
        label="Fahrenheit"
      />
      <p class="mt-2 text-xs text-muted-foreground">
        Holds nothing: °C × 9 / 5 + 32, and a write sets celsiusAtom.
      </p>
    </Part>
    <span class="flex justify-center">
      <Arrow label="get" pulse={celsius.current} />
    </span>
    <Part code label="feelAtom">
      It feels <FlashValue data-testid="feel" value={feel.current} />.
      <p class="mt-2 text-xs text-muted-foreground">Read-only, computed from °C.</p>
    </Part>
  </div>
</div>
