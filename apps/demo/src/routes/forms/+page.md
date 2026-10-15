---
title: Forms
description: Build a form from one Effect Schema, with errors that show at the right time and a submit that writes a mutation.
---

<script>
  import Aside from "#lib/docs/aside.svelte";
  import Example from "#lib/docs/example.svelte";

  import checkoutFormSource from "./checkout-form.ts?highlight";
  import orderFormSource from "./order-form.ts?highlight";
  import renameFormSource from "./rename-form.ts?highlight";
  import signUpFormSource from "./sign-up-form.ts?highlight";
  import LineItems from "./line-items.svelte";
  import lineItemsSource from "./line-items.svelte?highlight";
  import RenameTodo from "./rename-todo.svelte";
  import renameTodoSource from "./rename-todo.svelte?highlight";
  import addressFieldsSource from "./address-fields.svelte?highlight";
  import Checkout from "./checkout.svelte";
  import checkoutSource from "./checkout.svelte?highlight";
  import SignUp from "./sign-up.svelte";
  import signUpSource from "./sign-up.svelte?highlight";
</script>

A form here is built from one Effect **Schema**. You give the Schema; the library gives you the values your inputs bind to, the errors to show under each one, the attributes that wire an input to its error for screen readers, and a `submit` that decodes the values and sends them through a [mutation](/mutations). It draws nothing: the markup and the copy are yours.

This sign-up form checks the email when you leave the field, and once a field has shown an error, it checks again as you type. Under it, **What the form knows** shows each field's latest check, whether you've left the field, and whether its error is on screen: the Schema checks every change, and the timing decides what you see. Create account is always on: a submit shows every error and moves focus to the first one:

<Example files={[{ html: signUpSource, name: "sign-up.svelte" }, { html: signUpFormSource, name: "sign-up-form.ts" }]} hint="Type a few letters in Email: its check fails at once, but the error waits until you press Tab. Click Create account with the rest empty: every error shows, and focus moves to Email. Fill in the rest, with two passwords that differ, then make them match and watch form.valid turn true."> <div data-testid="sign-up-example"><SignUp /></div> </Example>

## Defining a form

A Schema from Effect describes a value twice. Its **encoded** side is the form the value travels in, and its **decoded** side is the form your code works with. `Schema.NumberFromString` is encoded as a string and decoded to a number; `Schema.Trim` is encoded as any string and decoded with the spaces trimmed.

A form uses both sides. The encoded side is what the inputs hold: text inputs hold strings, checkboxes booleans. The decoded side is what a submit sends. `Form.make` takes the Schema of the whole form, usually a `Schema.Struct`:

**Example** (A form's definition)

```ts
import { Schema } from "effect";
import { Form } from "effect-atom-svelte";

export const Login = Form.make(
  Schema.Struct({
    email: Schema.String.check(
      Schema.isPattern(/^\S+@\S+\.\S+$/u, {
        message: "Enter an email address",
      })
    ),
    password: Schema.String.check(
      Schema.isMinLength(8, {
        message: "At least 8 characters",
      })
    ),
  })
);
```

The sign-up example's own definition, with a confirm field and a terms checkbox, is in its `sign-up-form.ts` tab. The definition holds no state, so it lives in a module beside your atoms and every component that shows the form shares it. If you already have a Schema for the data, such as an RPC's payload, build the form from it: there are no separate field definitions to keep in step.

An error's message comes from the check's `message` annotation, as above. A check without one gets Effect's own message, such as `Expected a value with a length of at most 60`. To write those yourself, pass `leafHook` (for a value of the wrong type, or a missing key) or `checkHook` (for a failed check) to `Form.make`; a `message` annotation still wins over them.

Validation runs the Schema's decoding as an Effect, so a check can call a service, such as one that asks the server whether a username is free. Give `Form.make` a `runtime` (see [Services and runtimes](/services)) that provides it.

## Creating an instance

`useForm` creates an **instance** of the form in a component: its values, errors and state.

```svelte
<script lang="ts">
  import { useForm } from "effect-atom-svelte";
  import { Login } from "./forms.ts";

  const id = $props.id();
  const form = useForm(Login, {
    id,
    initialValues: { email: "", password: "" },
  });
</script>
```

- `id` is the start of every element id the form makes, such as `${id}-email` for the email input. Pass Svelte's `$props.id()`, which gives the same id on the server and in the browser, so the ids in the server's HTML match the ones the browser hydrates. A hook can't call `$props.id()` itself, as Svelte only allows it at the top of a component.
- `initialValues` are the encoded values to start from.

Each instance has its own state. Two components that show the same form don't share their values or errors, and the instance is released when its component is destroyed. To share one instance, create it in the parent and pass it down as a prop, or through context.

## Fields

`form.field("email")` is one field. For a nested value or an array item, give a path: `form.field(["address", "city"])` or `form.field(["items", 0, "quantity"])`. Paths are checked against the Schema's encoded type, so a typo or a path that isn't there is a type error.

A field has:

- `value`: its value, which you can assign, so `bind:value={field.value}` works. Use `bind:checked` for a checkbox.
- `error`: the message to show, or `undefined`. See [When errors show](#when-errors-show).
- `attrs`: attributes to spread on a native input: `name`, `id`, and, while there is an error, `aria-invalid` and `aria-describedby` pointing at the error's element, and an `onblur` that marks the field touched.
- `errorId`: the id to give the element that shows `error`, which `aria-describedby` points at.
- `touched` (the user has left the field), `dirty` (the value differs from the initial value) and `validating`.
- `constraints`: HTML attributes read from the Schema's checks, such as `maxlength` from `isMaxLength`, `min` and `max` from `isBetween`, and `required` where the Schema rejects an empty string. Spread them to get the browser's own limits too, such as stopping typing at the maximum length. They are kept out of `attrs`, so using them is your choice.

```svelte
<label for={email.id}>Email</label>
<input {...email.attrs} bind:value={email.value} />
<p class="min-h-5" id={email.errorId}>{email.error ?? ""}</p>
```

`form.attrs` goes on the `<form>`. It sets `novalidate`, so the browser's own error bubbles never compete with the form's errors, and an `onsubmit` that submits the form and, when the values don't decode, moves focus to the first field on the page with an error.

A control that isn't a native input, such as a date picker from a component library, takes only what it needs: its value through `field.value`, and `field.blur()` where it would fire blur.

<Aside type="tip" title="Number inputs">

For a number input, Svelte's `bind:value` on `type="number"` gives a number, or `null` when the input is empty, so the Schema's encoded type there is `number | null`. A text input with `inputmode="numeric"` holds a string, which `Schema.FiniteFromString` decodes: it fails on `abc`, where `Schema.NumberFromString` gives `NaN`. It decodes an empty string to `0`, so check that the string isn't empty first, as the quantity in [Arrays](#arrays) does.

</Aside>

## When errors show

Every change to the values decodes the whole form again, and only the newest run's result is kept. What decides whether a field's error is on screen is its **timing**, set on `Form.make`:

- `validateOn`: when a field's error first shows. `"blur"` by default: once the user leaves the field. `"input"` shows it as they type, and `"submit"` shows nothing before the first submit, not even an error that a change to one field brings on another.
- `revalidateOn`: when it updates after the field has shown an error, or once the form has been submitted. `"input"` by default.
- `debounce`: how long to wait after a change before decoding, such as `"300 millis"` for a check that calls the server.

The defaults are "reward early, validate late": no error while you type into a field for the first time, and once you've seen one, it goes the moment the value is right. An error whose check passes always goes at once, whatever the timing. And an error that a change to another field brings on, such as "Passwords do not match" after you edit the password, shows at once on a field you've already left.

Keep the space for each error's line, with an element that is always there, as the `min-h-5` paragraph above does: an error that appears as the user leaves a field otherwise pushes what's under it down, so a click on the submit button below can start on the button and end beside it, and never submit.

A submit shows every error, and after it, with `revalidateOn: "input"`, errors show as they appear. `form.validate(paths)` shows the errors under some paths and resolves whether they passed, as a wizard's Next button needs for its step. An error from the server or `setErrors` under those paths counts as a failure. With no paths it checks the whole form.

Each field knows more than it shows. `field.issue` is the latest check's message for a field, whether or not its error shows yet. It's what the sign-up example's table reads, and what a live password checklist would read. For a form that shows every error as you type, use `validateOn: "input"`.

The form as a whole knows two things. `form.valid` is false while the values fail the Schema, while a check is still running, and while an error from the server or `setErrors` is set, whatever is on screen. `form.errors` lists the errors on show, in the Schema's order, for a summary at the top. The sign-up example leaves its button on rather than `disabled={!form.valid}`, so a click shows the user what to fix.

## Submitting

A submit decodes the values and, if they decode, writes them to a **submit atom**: a mutation from `Atom.fn`, `runtime.fn` or an [RPC](/rpc) or [HTTP API](/http) client. While it runs, `form.submitting` is true, and once it settles, `form.submitResult` is the mutation's `AsyncResult`. Both belong to this instance: another component writing the same mutation doesn't change them.

```ts
const form = useForm(Login, {
  id,
  initialValues: { email: "", password: "" },
  submit: { atom: loginAtom },
});
```

The atom gets the decoded values. When it takes something else, `payload` builds that from them. Values that aren't fields, such as an id from the page, come in through `form.submit(args)`:

```ts
const form = useForm(EditProject, {
  id,
  initialValues,
  submit: {
    atom: ProjectsRpc.mutation("updateProject"),
    payload: (decoded, projectId: string) => ({
      payload: { id: projectId, ...decoded },
      reactivityKeys: ["projects"],
    }),
  },
});

// In a handler:
await form.submit(projectId);
```

`form.submit` resolves with the mutation's `Exit`, an Effect value that is either the success or the failure. When the values don't decode, the submit atom isn't called and the `Exit` fails with `Form.ValidationError`, whose `_tag` is `"FormValidationError"`. A second submit while one runs doesn't start another: it gets the running one's result.

A submit holds its atom until it settles, as `useAtomSet`'s promise modes do (see [Mutations](/mutations#waiting-for-the-result)). A save started in a dialog still finishes if the dialog closes, and reopening it creates a fresh instance.

<Aside type="caution" title="Two instances, one atom">

Writes to one `Atom.fn` share its single result: a new call interrupts one still running, and every call still waiting resolves with the newest call's result. So if two instances submit to the same atom at once, the first one's submit resolves with the second one's result, and its form takes that as its own success, although its values were never saved. Give each instance its own atom where two can submit at once: an `Atom.fn` created in the component's script is one per instance. An RPC or HTTP client's `mutation(...)` is not: it returns the same atom for the same procedure wherever it's called, so for one per instance build it from the client's `runtime.fn` in the component's script.

</Aside>

### Server errors on fields

A mutation's typed failure often belongs on a field: the email is already taken. `mapError` claims a failure by returning errors for the form's top-level fields (`fields`), for the form as a whole (`form`), or both. For a nested field, give `paths`, such as `paths: [[["address", "city"], "No such city"]]`:

```ts
mapError: (error) => {
  switch (error._tag) {
    case "EmailTaken":
      return { fields: { email: "That email is taken" } };
    case "InvitePending":
      return { form: "An invite is already on its way" };
    default:
      return undefined;
  }
},
```

A field error from `mapError` shows at once and goes when the user edits that field. The form error is `form.rootError`, which goes when the user changes any value, or at the next submit. A failure that `mapError` returns `undefined` for stays in `submitResult`, for the app to show its own way, such as a toast. A claimed failure never appears there, so it isn't shown twice. Defects and interruptions are never passed to `mapError`.

`form.setErrors({ fields, paths, form })` puts errors on the form from anywhere else. They clear the same way: a field's error when that field changes, and the form error when any value changes. They don't stop a submit, which checks only the Schema: if the user submits again without changing anything, the server sees the values again and decides.

## Edit forms

An edit form starts from data that is already saved. Give `initialValues` as a function, and the form follows it: when the data changes, such as when a query fetches again, a form you haven't edited takes the new values, and one you have keeps your edits.

After a successful submit, the submitted values become the initial values, `form.initialValues`, so the form is clean again and `form.dirty` is false. `form.lastSubmitted` holds them, encoded and decoded, and `form.revertToLastSubmit()` goes back to them, or to the initial values before any submit. `form.reset()` goes back to the initial values too, but also clears `lastSubmitted` and `submitResult`. For a form that creates something instead, `resetOnSuccess: true` goes back to `initialValues` after each save, keeping `lastSubmitted` and `submitResult`.

This form renames a todo on the demo API, and its Undo button calls `revertToLastSubmit`. Another todo is already called "Write a Svelte adapter", and the server refuses a second one with a `DuplicateTitle` error, which `mapError` puts on the field. A claimed failure isn't kept in `submitResult`, so the panel shows it as `Initial`:

<Example files={[{ html: renameTodoSource, name: "rename-todo.svelte" }, { html: renameFormSource, name: "rename-form.ts" }]} hint="Rename the todo: dirty turns true. Save it: the new title becomes initialValues and lastSubmitted, and dirty is false again. Type another title and click Undo: the saved one comes back. Then type Write a Svelte adapter and save: the server's error lands on the field, and submitResult is Initial. Leave a change unsaved and click a link in the sidebar: the page asks first."> <div data-testid="rename-example"><RenameTodo /></div> </Example>

### Asking before leaving

`useUnsavedChangesGuard`, from `effect-atom-svelte/sveltekit`, asks before the user leaves a page with a form that has unsaved changes. It takes anything with a `dirty` property, and a `confirm` that resolves `true` to leave:

```ts
import { useUnsavedChangesGuard } from "effect-atom-svelte/sveltekit";

useUnsavedChangesGuard(form, {
  confirm: () => window.confirm("Discard the new title?"),
});
```

It uses SvelteKit's `beforeNavigate`, which runs before every navigation. For a link, a `goto`, or the back and forward buttons, it cancels the navigation, awaits `confirm`, and on yes navigates again. `confirm` can open your own dialog, as it is awaited. Closing the tab, reloading and typing a new address show the browser's own dialog instead: a page can't show its own then.

SvelteKit doesn't call `beforeNavigate` for back and forward over history entries a page added itself (with `pushState`, or by changing the hash), or for a link to a hash on the same page, so those leave without asking.

## Checks across fields

A check on a Struct sees all of its fields, for rules such as "the passwords match". Return `{ path, issue }` from `Schema.makeFilter` to put the error on one field:

```ts
const NewPassword = Schema.Struct({
  confirm: Schema.String,
  value: Schema.String.check(Schema.isMinLength(8)),
}).check(
  Schema.makeFilter(
    ({ confirm, value }) =>
      confirm === value || {
        issue: "Passwords do not match",
        path: ["confirm"],
      }
  )
);
```

Effect runs a Struct's check only once every field of that Struct decodes. So put the check on the smallest group that holds the fields it compares, as the sign-up example does with `password: NewPassword`. On the whole form, "Passwords do not match" would also wait for a valid email and a ticked terms box. Here it waits only for the password, whose own check comes first: the example's table shows `password.confirm` passing until the password is 8 characters long. A check that returns no `path` is its Struct's error; on the form's top-level Struct, that's `form.rootError`, which shows only after a `submit` or a `validate()`.

## Arrays

`form.array("items")` is an array field. `append`, `remove`, `move` and `replace` change it, and `items` lists its items, each with its own fields. Each item has a `key` that stays with it when items move, so its errors and touched state move with it, and a keyed `{#each}` keeps its inputs:

<Example files={[{ html: lineItemsSource, name: "line-items.svelte" }, { html: orderFormSource, name: "order-form.ts" }]} hint="Place the order: Ink has no quantity. Move Ink to the top: its key, and its error, go with it. Click Add item: the blank row's errors show at once, as after a submit every error shows. Remove every item to see the array's own error."> <div data-testid="order-example"><LineItems /></div> </Example>

An error on the array itself, such as from `isMinLength(1)`, is `items.error`.

## Groups of fields

`form.at("billing")` gives the fields under one path as a **group**, with the same `field`, `array` and `at`, relative to it. A component that edits an address takes a group of the address's shape, `Form.Group<{ city: string; street: string }>`, and works for any part of any form that has one. The checkout example below uses one component for both its addresses:

```svelte
<AddressFields fields={form.at("billing")} legend="Billing address" />
<AddressFields
  fields={form.at(["fulfilment", "address"])}
  legend="Delivery address"
/>
```

Fields that several forms share are a Schema you reuse, such as an `Address` Struct in each form's Schema.

## Unions

A form whose fields depend on a choice uses a union of Structs with a tag, such as `Schema.TaggedUnion`. Effect decodes the member the tag picks, so only that member's fields report errors. When the tag changes, the other member's values stay in the form, so switching back restores them, but they aren't decoded or submitted.

In this checkout, an order is delivered to an address or picked up from a store:

<Example files={[{ html: checkoutSource, name: "checkout.svelte" }, { html: addressFieldsSource, name: "address-fields.svelte" }, { html: checkoutFormSource, name: "checkout-form.ts" }]} hint="Type a delivery street, click Pickup, then Delivery: the street is still there. Click Pickup and place the order with the rest empty: the store and Billing complain, while Delivery's address isn't checked, as Pickup is chosen."> <div data-testid="checkout-example"><Checkout /></div> </Example>

## Drafts that survive a reload

A form keeps its values in an atom of its own. Pass `values` to keep them in yours instead, such as an [`Atom.kvs`](/browser) atom stored in `localStorage`, so a half-written draft survives a reload. The form still compares them with `initialValues` for `dirty`, and `reset` writes the initial values back to your atom.

## Without Svelte

`Form.instance` creates an instance outside a component, for tests and for code that isn't a component. It takes the same options, plus an optional `registry`, and lives until you call `dispose`:

```ts
import { Exit } from "effect";
import { Form } from "effect-atom-svelte";
import { expect, test } from "vitest";

import { Login } from "./forms.ts";

test("a submit shows every error", async () => {
  const form = Form.instance(Login, {
    id: "test",
    initialValues: { email: "", password: "" },
  });
  const exit = await form.submit();
  expect(Exit.isFailure(exit)).toBe(true);
  const password = form.field("password");
  expect(password.error).toBe("At least 8 characters");
  form.dispose();
});
```

## Server rendering

On the server a form renders from its `initialValues` and doesn't validate. The browser starts from the same `initialValues` and gets the same ids from `$props.id()`, so there is nothing to send with the page and nothing to hydrate. When `initialValues` come from a query, await it with [`useAtomResult`](/suspense#awaiting-in-the-script), as the rename example does, so the server renders the saved data.
