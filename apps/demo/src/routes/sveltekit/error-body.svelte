<!--
  Beside the failed snippet in the "Errors in boundaries" example: the App.Error it received from
  this site's client hook (handleClientError), next to what SvelteKit's default hook would have
  passed. Presentation only: boundary-errors.svelte holds the example's logic.
-->
<script lang="ts">
  import Part from "#lib/docs/kit/part.svelte";
  import Parts from "#lib/docs/kit/parts.svelte";

  const { error }: { error: unknown } = $props();

  const fields = $derived.by(() => {
    // SAFETY: the site's handleError hook (hooks.client.ts) turns every error a
    // boundary receives into an App.Error.
    const { message, tag } = error as App.Error;
    return [
      `message: ${JSON.stringify(message)}`,
      ...(tag ? [`tag: ${JSON.stringify(tag)}`] : []),
    ];
  });
</script>

<Parts class="mt-3" columns={2}>
  <Part
    code
    data-testid="error-body"
    label="error, from handleClientError"
    tone="failure"
  >
    <code class="body">{`{ ${fields.join(", ")} }`}</code>
  </Part>
  <Part code dashed label="SvelteKit's default hook">
    <code class="body">{'{ message: "Internal Error" }'}</code>
  </Part>
</Parts>

<style>
  .body {
    font-size: 0.8rem;
    overflow-wrap: anywhere;
  }
</style>
