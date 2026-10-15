<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  // A pretend sign-up that takes a second, as a request would.
  const signUpAtom = Atom.fn((input: { email: string }) =>
    Effect.sleep("1 second").pipe(Effect.as(input.email))
  );
</script>

<script lang="ts">
  import { useForm } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  import FormKnows from "./form-knows.svelte";
  import { SignUp } from "./forms.ts";

  // An id that matches between the server's HTML and the browser.
  const id = $props.id();
  const form = useForm(SignUp, {
    id,
    initialValues: { confirmPassword: "", email: "", password: "", terms: false },
    submit: { atom: signUpAtom },
  });
  const email = form.field("email");
  const password = form.field("password");
  const confirmPassword = form.field("confirmPassword");
  const terms = form.field("terms");
</script>

<div class="grid gap-6">
  <form {...form.attrs} class="grid max-w-sm gap-1" data-testid="sign-up">
    <label for={email.id}>Email</label>
    <input {...email.attrs} autocomplete="email" bind:value={email.value} />
    {#if email.error}<p class="field-error" id={email.errorId}>{email.error}</p>{/if}

    <label class="mt-2" for={password.id}>Password</label>
    <input {...password.attrs} bind:value={password.value} type="password" />
    {#if password.error}
      <p class="field-error" id={password.errorId}>{password.error}</p>
    {/if}

    <label class="mt-2" for={confirmPassword.id}>Confirm password</label>
    <input {...confirmPassword.attrs} bind:value={confirmPassword.value} type="password" />
    {#if confirmPassword.error}
      <p class="field-error" id={confirmPassword.errorId}>{confirmPassword.error}</p>
    {/if}

    <label class="mt-2 flex items-center gap-2 font-normal">
      <input {...terms.attrs} bind:checked={terms.value} type="checkbox" />
      I agree to the terms
    </label>
    {#if terms.error}<p class="field-error" id={terms.errorId}>{terms.error}</p>{/if}

    <p class="mt-2">
      <!-- Off until every check passes, whatever is on screen. -->
      <button disabled={!form.valid || form.submitting}>
        {form.submitting ? "Creating…" : "Create account"}
      </button>
    </p>
    {#if form.submitResult._tag === "Success"}
      <ResultChip kind="message" label="signUpAtom" tone="success">
        <span data-testid="sign-up-done">Account created for {form.submitResult.value}</span>
      </ResultChip>
    {/if}
  </form>
  <FormKnows fields={{ confirmPassword, email, password, terms }} valid={form.valid} />
</div>
