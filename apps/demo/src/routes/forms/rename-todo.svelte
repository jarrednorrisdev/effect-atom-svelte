<script module lang="ts">
  import { TodosRpc } from "#lib/clients.ts";

  // The demo API's first todo. Renaming it invalidates "todos", so this fetches again.
  const todoAtom = TodosRpc.query(
    "getTodo",
    { id: 1 },
    {
      reactivityKeys: ["todos"],
      serializationKey: "forms-todo-1",
    }
  );
  const renameAtom = TodosRpc.mutation("renameTodo");
</script>

<script lang="ts">
  import { useAtomResult, useForm } from "effect-atom-svelte";
  import { useUnsavedChangesGuard } from "effect-atom-svelte/sveltekit";

  import CauseView from "#lib/docs/kit/cause-view.svelte";

  import FormState from "./form-state.svelte";
  import { RenameTodo } from "./forms.ts";

  const id = $props.id();
  const todo = await useAtomResult(todoAtom);
  const form = useForm(RenameTodo, {
    id,
    // Follows the query: a clean form takes a new title, a dirty one keeps your edit.
    initialValues: () => ({
      title: todo.current._tag === "Success" ? todo.current.value.title : "",
    }),
    // The server's DuplicateTitle goes on the field. Any other failure stays in
    // submitResult.
    mapError: (error) =>
      error._tag === "DuplicateTitle"
        ? { fields: { title: "Another todo has that title" } }
        : undefined,
    submit: {
      atom: renameAtom,
      payload: ({ title }) => ({
        payload: { id: 1, title },
        reactivityKeys: ["todos"],
      }),
    },
  });
  const title = form.field("title");

  // Asks before you leave the page with an unsaved title.
  useUnsavedChangesGuard(form, {
    // confirm may also open a dialog of your own: it is awaited.
    // oxlint-disable-next-line no-alert -- the browser's dialog keeps the example short
    confirm: () => window.confirm("Leave without saving the new title?"),
  });
</script>

<form {...form.attrs} class="grid max-w-md gap-1" data-testid="rename">
  <label for={title.id}>Title of todo 1</label>
  <input {...title.attrs} {...title.constraints} bind:value={title.value} />
  {#if title.error}<p class="field-error" id={title.errorId}>
      {title.error}
    </p>{/if}
  <p class="mt-2 flex flex-wrap items-center gap-2">
    <!-- Nothing to save until the title changes. -->
    <button disabled={!form.dirty || form.submitting}>Save</button>
    <button disabled={!form.dirty} onclick={() => form.reset()} type="button"
      >Undo</button
    >
  </p>
</form>
<FormState
  dirty={form.dirty}
  initial={form.initialValues}
  lastSubmitted={form.lastSubmitted}
  result={form.submitResult}
/>
{#if form.submitResult._tag === "Failure"}
  <CauseView cause={form.submitResult.cause} code label="renameAtom" />
{/if}
