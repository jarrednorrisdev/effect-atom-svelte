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
  import { useAtom, useAtomValue } from "effect-atom-svelte";
  import CauseView from "#lib/docs/kit/cause-view.svelte";
  import EffectType from "#lib/docs/kit/effect-type.svelte";
  import ResultChip from "#lib/docs/kit/result-chip.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";

  const text = useAtom(textAtom);
  const todo = useAtomValue(todoAtom);
</script>

<div aria-label="Sample" class="flex flex-wrap gap-2" role="group">
  {#each samples as [name, sample] (name)}
    <button
      aria-pressed={text.current === sample}
      onclick={() => (text.current = sample)}
    >
      {name}
    </button>
  {/each}
</div>
<div class="mt-3">
  <textarea
    aria-label="JSON"
    bind:value={text.current}
    class="w-full font-mono text-sm"
    data-testid="decode-input"
    rows="2"
  ></textarea>
</div>
<p class="mt-2 mb-3 flex flex-wrap items-center gap-3">
  <EffectType
    error="SchemaError"
    name="decode(text)"
    result={todo.current}
    success="Todo"
  />
  <StateBadge data-testid="decode-state" result={todo.current} />
</p>
{#if todo.current._tag === "Success"}
  {@const { done, id, title } = todo.current.value}
  <ResultChip kind="message" label="todoAtom" tone="success">
    <span data-testid="decode">#{id} {title}, done: {done}</span>
  </ResultChip>
{:else if todo.current._tag === "Failure"}
  <CauseView
    cause={todo.current.cause}
    code
    data-testid="decode-cause"
    label="todoAtom"
  />
{/if}
