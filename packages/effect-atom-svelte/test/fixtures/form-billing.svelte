<!-- A billing address laid out street first, while its Schema lists city first. -->
<script lang="ts">
  import { useForm } from "../../src/index.ts";
  import { Billing } from "./form-atoms.ts";

  const id = $props.id();
  const form = useForm(Billing, {
    id,
    initialValues: { city: "", street: "" },
  });
  const street = form.field("street");
  const city = form.field("city");
</script>

<form {...form.attrs}>
  <label for={street.id}>Street</label>
  <input {...street.attrs} bind:value={street.value} />
  {#if street.error}<p id={street.errorId}>{street.error}</p>{/if}
  <label for={city.id}>City</label>
  <input {...city.attrs} bind:value={city.value} />
  {#if city.error}<p id={city.errorId}>{city.error}</p>{/if}
  <button>Pay</button>
  <output>{form.errors.map((error) => error.path.join(".")).join(" ")}</output>
</form>
