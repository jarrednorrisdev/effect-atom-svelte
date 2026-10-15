<script lang="ts">
  import type { Form } from "effect-atom-svelte";

  // Any form with an address of this shape can pass its part:
  // form.at("billing").
  interface Props {
    readonly fields: Form.Group<{
      readonly city: string;
      readonly street: string;
    }>;
    readonly legend: string;
  }

  const { fields, legend }: Props = $props();
  // $derived follows the prop: given another group, these
  // become its fields.
  const street = $derived(fields.field("street"));
  const city = $derived(fields.field("city"));
</script>

<fieldset class="grid gap-1 border p-3">
  <legend class="px-1 text-sm font-medium">{legend}</legend>
  <label for={street.id}>Street</label>
  <input {...street.attrs} bind:value={street.value} />
  <p class="field-error min-h-5" id={street.errorId}>
    {street.error ?? ""}
  </p>
  <label for={city.id}>City</label>
  <input {...city.attrs} bind:value={city.value} />
  <p class="field-error min-h-5" id={city.errorId}>
    {city.error ?? ""}
  </p>
</fieldset>
