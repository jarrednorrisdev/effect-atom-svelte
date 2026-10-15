<script module lang="ts">
  import { Data, Effect } from "effect";
  import { Atom } from "effect/reactivity";

  class WrongPassword extends Data.TaggedError("WrongPassword")<{
    readonly email: string;
  }> {}

  // A pretend sign-in that takes a second, as a request would. Only the password
  // "atom" works.
  const signInAtom = Atom.fn((input: { email: string; password: string }) =>
    Effect.gen(function* signIn() {
      yield* Effect.sleep("1 second");
      if (input.password !== "atom") {
        return yield* new WrongPassword({ email: input.email });
      }
      return input.email;
    })
  );
</script>

<script lang="ts">
  import { useForm } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  import { SignIn } from "./forms.ts";

  // An id that matches between the server's HTML and the browser, for the inputs' ids.
  const id = $props.id();
  const form = useForm(SignIn, {
    id,
    initialValues: { email: "", password: "" },
    // A wrong password is the form's error, not one field's.
    mapError: () => ({ form: "Wrong email or password" }),
    submit: { atom: signInAtom },
  });
  const email = form.field("email");
  const password = form.field("password");
</script>

<form {...form.attrs} class="grid max-w-sm gap-1" data-testid="sign-in">
  <label for={email.id}>Email</label>
  <input {...email.attrs} autocomplete="email" bind:value={email.value} />
  {#if email.error}<p class="field-error" id={email.errorId}>{email.error}</p>{/if}

  <label class="mt-2" for={password.id}>Password</label>
  <input
    {...password.attrs}
    autocomplete="current-password"
    bind:value={password.value}
    type="password"
  />
  {#if password.error}
    <p class="field-error" id={password.errorId}>{password.error}</p>
  {/if}

  {#if form.rootError}<p class="field-error" role="alert">{form.rootError}</p>{/if}
  <p class="mt-2">
    <button disabled={form.submitting}>{form.submitting ? "Signing in…" : "Sign in"}</button>
  </p>
</form>
{#if form.submitResult._tag === "Success"}
  <ResultChip kind="message" label="signInAtom" tone="success">
    <span data-testid="sign-in-done">Signed in as {form.submitResult.value}</span>
  </ResultChip>
{/if}
