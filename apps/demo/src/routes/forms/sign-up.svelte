<script module lang="ts">
  import { Effect } from "effect";
  import { Atom } from "effect/reactivity";

  // A pretend sign-up that takes a second, as a request
  // would.
  const signUpAtom = Atom.fn((input: { email: string }) =>
    Effect.sleep("1 second").pipe(Effect.as(input.email))
  );
</script>

<script lang="ts">
  import { useForm } from "effect-atom-svelte";

  import ResultChip from "#lib/docs/kit/result-chip.svelte";

  import FormKnows from "./form-knows.svelte";
  import { SignUp } from "./sign-up-form.ts";

  // An id that matches between the server's HTML and the
  // browser.
  const id = $props.id();
  const form = useForm(SignUp, {
    id,
    initialValues: {
      email: "",
      password: { confirm: "", value: "" },
      terms: false,
    },
    submit: { atom: signUpAtom },
  });
  const email = form.field("email");
  const password = form.field(["password", "value"]);
  const confirm = form.field(["password", "confirm"]);
  const terms = form.field("terms");
</script>

<div class="grid min-w-0 gap-6">
  <!-- Each error line keeps its space while empty, so an
       error that shows as you leave a field doesn't move the
       button out from under your click. -->
  <form
    {...form.attrs}
    class="grid max-w-sm gap-1"
    data-testid="sign-up"
  >
    <label for={email.id}>Email</label>
    <input
      {...email.attrs}
      autocomplete="email"
      bind:value={email.value}
    />
    <p class="field-error min-h-5" id={email.errorId}>
      {email.error ?? ""}
    </p>

    <label for={password.id}>Password</label>
    <input
      {...password.attrs}
      bind:value={password.value}
      type="password"
    />
    <p class="field-error min-h-5" id={password.errorId}>
      {password.error ?? ""}
    </p>

    <label for={confirm.id}>Confirm password</label>
    <input
      {...confirm.attrs}
      bind:value={confirm.value}
      type="password"
    />
    <p class="field-error min-h-5" id={confirm.errorId}>
      {confirm.error ?? ""}
    </p>

    <label class="flex items-center gap-2 font-normal">
      <input
        {...terms.attrs}
        bind:checked={terms.value}
        type="checkbox"
      />
      I agree to the terms
    </label>
    <p class="field-error min-h-5" id={terms.errorId}>
      {terms.error ?? ""}
    </p>

    <p class="mt-2">
      <!-- Always on: a submit shows every error and moves
           focus to the first one. -->
      <button disabled={form.submitting}>
        {form.submitting ? "Creating…" : "Create account"}
      </button>
    </p>
    {#if form.submitResult._tag === "Success"}
      <ResultChip
        kind="message"
        label="signUpAtom"
        tone="success"
      >
        <span data-testid="sign-up-done">
          Account created for {form.submitResult.value}
        </span>
      </ResultChip>
    {/if}
  </form>
  <FormKnows
    fields={{
      email,
      "password.confirm": confirm,
      "password.value": password,
      terms,
    }}
    valid={form.valid}
  />
</div>
