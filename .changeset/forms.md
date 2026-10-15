---
"effect-atom-svelte": minor
---

Add forms built from one Effect Schema (#60). `Form.make` defines a form, `useForm` creates an instance in a component and `Form.instance` creates one without Svelte. An instance gives each field a bindable value, an error that shows at the right time (`validateOn`, `revalidateOn`, `debounce`), attributes that wire an input to its error, and HTML constraints read from the Schema's checks. Its submit decodes the values and writes them to a mutation, holds it until it settles, maps typed failures onto fields with `mapError`, and leaves the rest in `submitResult`. `field.issue` gives the latest check's message before the timing shows it, for a live checklist. An instance's atoms are labelled with the form's `name` (`SignUp.values`, `SignUp.state`, `SignUp.check`). Array fields keep each item's errors and touched state with it when items move, and `form.at` hands part of a form to a component.

`effect-atom-svelte/sveltekit` adds `useUnsavedChangesGuard`, which asks before leaving a page whose form has unsaved changes. The module now imports `$app/navigation`, so it loads only inside a SvelteKit app, where its `handleError` hooks were already used.
