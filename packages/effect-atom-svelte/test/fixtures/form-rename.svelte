<!-- An edit form whose initial values follow a prop, saving to the atom it is given. -->
<script lang="ts">
  import type { AsyncResult, Atom } from "effect/reactivity";

  import { useForm } from "../../src/index.ts";
  import { Rename } from "./form-atoms.ts";

  interface Props {
    readonly title: string;
    readonly save: Atom.Writable<
      AsyncResult.AsyncResult<string, never>,
      { title: string }
    >;
  }

  const props: Props = $props();
  const id = $props.id();
  const form = useForm(Rename, {
    id,
    initialValues: () => ({ title: props.title }),
    submit: { atom: () => props.save },
  });
  const title = form.field("title");
</script>

<form {...form.attrs}>
  <input aria-label="Title" {...title.attrs} bind:value={title.value} />
  <button>Save</button>
  <output>{form.dirty ? "dirty" : "clean"} {form.submitResult._tag}</output>
</form>
