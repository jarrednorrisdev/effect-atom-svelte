<!-- A sign-in form, as the guide writes one. Rendered on the server for the hydration test too. -->
<script lang="ts">
  import { useForm } from "../../src/index.ts";
  import { SignIn, signInAtom } from "./form-atoms.ts";

  const id = $props.id();
  const form = useForm(SignIn, {
    id,
    initialValues: { email: "", password: "" },
    mapError: (error) =>
      error._tag === "WrongPassword"
        ? { form: "Wrong email or password" }
        : undefined,
    submit: { atom: signInAtom },
  });
  const email = form.field("email");
  const password = form.field("password");
</script>

<form {...form.attrs}>
  <label for={email.id}>Email</label>
  <input {...email.attrs} bind:value={email.value} />
  {#if email.error}<p id={email.errorId}>{email.error}</p>{/if}
  <label for={password.id}>Password</label>
  <input {...password.attrs} type="password" bind:value={password.value} />
  {#if password.error}<p id={password.errorId}>{password.error}</p>{/if}
  {#if form.rootError}<p role="alert">{form.rootError}</p>{/if}
  <button disabled={form.submitting}>Sign in</button>
  <output>{form.submitResult._tag}</output>
</form>
