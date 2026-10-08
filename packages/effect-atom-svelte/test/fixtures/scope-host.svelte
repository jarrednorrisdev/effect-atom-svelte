<!-- An inspector scope around a reader, which it can unmount, next to a reader outside it. -->
<script lang="ts">
  import type { InspectorScope } from "../../src/Inspector.ts";
  import { provideRegistry } from "../../src/index.ts";
  import ScopeChild from "./scope-child.svelte";
  import ScopeOutside from "./scope-outside.svelte";

  const { onscope, shown = true }: {
    readonly onscope: (scope: InspectorScope) => void;
    readonly shown?: boolean;
  } = $props();
  provideRegistry();
</script>

<ScopeChild {onscope} {shown} />
<ScopeOutside />
