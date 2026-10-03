<script lang="ts">
  import ApiModule from "#lib/docs/api-module.svelte";

  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
</script>

<ApiModule module={data.module} />
