<script lang="ts">
  import type { Form } from "effect-atom-svelte";

  // Any form with an address of this shape can pass its part: form.at("billing").
  interface Props {
    readonly fields: Form.Group<{ readonly city: string; readonly street: string }>;
    readonly legend: string;
  }

  const { fields, legend }: Props = $props();
  const street = $derived(fields.field("street"));
  const city = $derived(fields.field("city"));
</script>

<fieldset class="grid gap-1 rounded-lg border p-3">
  <legend class="px-1 text-sm font-medium">{legend}</legend>
  <label for={street.id}>Street</label>
  <input {...street.attrs} bind:value={street.value} />
  {#if street.error}<p class="field-error" id={street.errorId}>{street.error}</p>{/if}
  <label class="mt-1" for={city.id}>City</label>
  <input {...city.attrs} bind:value={city.value} />
  {#if city.error}<p class="field-error" id={city.errorId}>{city.error}</p>{/if}
</fieldset>
