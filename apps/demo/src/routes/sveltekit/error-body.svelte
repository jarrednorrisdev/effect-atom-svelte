<!--
  Beside the failed snippet in the "Errors in boundaries" example: the App.Error it received from
  this site's client hook (handleClientError), next to what SvelteKit's default hook would have
  passed. Presentation only: boundary-errors.svelte holds the example's logic.
-->
<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";

  const { error }: { error: unknown } = $props();

  const fields = $derived.by(() => {
    const { message, tag } = error as App.Error;
    return [`message: ${JSON.stringify(message)}`, ...(tag ? [`tag: ${JSON.stringify(tag)}`] : [])];
  });
</script>

<div class="bodies not-prose">
  <Part code data-testid="error-body" label="error, from handleClientError" tone="failure">
    <code class="body">{`{ ${fields.join(", ")} }`}</code>
  </Part>
  <Part code dashed label="SvelteKit's default hook">
    <code class="body">{'{ message: "Internal Error" }'}</code>
  </Part>
</div>

<style>
  .bodies {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    margin-top: 0.75rem;
  }
  .body {
    font-size: 0.8rem;
    overflow-wrap: anywhere;
  }
</style>
