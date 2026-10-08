<!-- Outside the scope: what it reads must not appear in it. -->
<script lang="ts">
  import { Atom } from "effect/reactivity";

  import { useAtomValue } from "../../src/index.ts";

  const outside = useAtomValue(Atom.make("outside").pipe(Atom.withLabel("outsideAtom")));
</script>

<span>{outside.current}</span>
