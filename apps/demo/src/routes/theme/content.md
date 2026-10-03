<script>
  import counter from "../basics/+page.svelte?highlight";
</script>

## Reading atoms

Use `useAtomValue` to read an atom from a component. The value updates whenever the atom changes, and the subscription ends when the component is destroyed. See the [Effect docs](https://effect.website/docs/v4) for how atoms are built.

- An atom is read through the registry from context.
- Async atoms return an `AsyncResult`.

> Callouts and quotes use the border and quote colours.

**Example** (Reading a Counter)

```ts
import { Atom } from "effect/unstable/reactivity";

// A writable atom holding a number
const count = Atom.make(0);

export const doubled = Atom.make((get) => get(count) * 2);
```

### Imported source

The block below is a whole file, highlighted at build time from a `?highlight` import.

{@html counter}
