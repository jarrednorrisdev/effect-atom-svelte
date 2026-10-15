<!--
  The component under test, drawn as a part of the example for the Testing page. Presentation
  only: counter.svelte, which the page shows beside its test, stays as the test renders it.
-->
<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";

  import Counter from "./counter.svelte";
</script>

<Part
  code
  label="counter.svelte"
  note="the component under test, reading countAtom"
>
  <Counter />
</Part>
