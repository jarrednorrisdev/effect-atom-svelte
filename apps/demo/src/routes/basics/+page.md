---
title: Basics
description: Reading, writing, binding and deriving atoms.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import Basics from "./basics.svelte";
  import basicsSource from "./basics.svelte?highlight";
</script>

The example below runs on this page; its source follows it.

<Example files={[{ html: basicsSource, name: "basics.svelte" }]}> <Basics /> </Example>

<Aside type="tip">

Atoms defined in `<script module>` are created once and shared by every instance of the component.

</Aside>
