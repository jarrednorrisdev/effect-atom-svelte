<script module lang="ts">
  import { Schema } from "effect";
  import { Atom } from "effect/reactivity";

  const Todo = Schema.Struct({
    done: Schema.Boolean,
    id: Schema.Int,
    title: Schema.String,
  });

  // Parses the JSON text, then checks the result against Todo.
  const decode = Schema.decodeUnknownEffect(Schema.fromJsonString(Todo));

  // Some JSON to try, as [name, text].
  const samples = [
    ["Valid", `{ "done": false, "id": 1, "title": "Write the docs" }`],
    ["Not an integer", `{ "done": false, "id": 1.5, "title": "Write the docs" }`],
    ["Missing title", `{ "done": false, "id": 1 }`],
  ] as const;

  const textAtom = Atom.make<string>(samples[0][1]);
  // Succeeds with a Todo, or fails with a SchemaError that says what is wrong.
  const todoAtom = Atom.make((get) => decode(get(textAtom)));
</script>

<script lang="ts">
  import { Cause, Option } from "effect";
  import { useAtom, useAtomValue } from "effect-atom-svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const text = useAtom(textAtom);
  const todo = useAtomValue(todoAtom);

  // A SchemaError's message says what is wrong, and where.
  const describe = (cause: Cause.Cause<Schema.SchemaError>) =>
    Option.match(Cause.findErrorOption(cause), {
      onNone: () => Cause.pretty(cause),
      onSome: (error) => error.message,
    });
</script>

<p class="flex flex-wrap gap-2">
  {#each samples as [name, sample] (name)}
    <button onclick={() => (text.current = sample)}>{name}</button>
  {/each}
</p>
<textarea
  aria-label="JSON"
  bind:value={text.current}
  class="w-full font-mono text-sm"
  data-testid="decode-input"
  rows="2"
></textarea>
<div class="mt-2 flex flex-wrap items-center gap-3">
  {#if todo.current._tag === "Success"}
    {@const { done, id, title } = todo.current.value}
    <ResultChip kind="message" label="Todo" tone="success">
      <span data-testid="decode">#{id} {title}, done: {done}</span>
    </ResultChip>
  {:else if todo.current._tag === "Failure"}
    <ResultChip kind="message" label="SchemaError" tone="failure">
      <span data-testid="decode" class="whitespace-pre-wrap">
        {describe(todo.current.cause)}
      </span>
    </ResultChip>
  {/if}
  <StateBadge data-testid="decode-state" result={todo.current} />
</div>
