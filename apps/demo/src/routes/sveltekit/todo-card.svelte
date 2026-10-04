<script module lang="ts">
  import { Effect, Schema } from "effect";
  import { AsyncResult, Atom } from "effect/reactivity";

  import { browser } from "$app/env";

  const titles = ["Write the docs", "Ship 0.1.0", "Propose it upstream", "Rest"];

  const Todo = Schema.Struct({ title: Schema.String, where: Schema.String });

  // One atom per todo, with the id in its serialization key. It records where it ran.
  const todoAtom = Atom.family((id: number) =>
    Atom.make(
      Effect.sync(() => ({
        title: titles[id - 1] ?? "?",
        where: browser ? "browser" : "server",
      })).pipe(Effect.delay("400 millis"))
    ).pipe(
      Atom.serializable({
        key: `card-todo-${id}`,
        schema: AsyncResult.Schema({ success: Todo }),
      })
    )
  );
</script>

<script lang="ts">
  import { useAtomResult } from "effect-atom-svelte";
  import Origin from "#lib/docs/kit/origin.svelte";
  import Part from "#lib/docs/kit/part.svelte";
  import StateBadge from "#lib/docs/kit/state-badge.svelte";
  import { toneOf } from "#lib/docs/kit/tone.ts";

  const { id }: { id: number } = $props();

  // The server render waits for it, and the browser starts from the server's result.
  const todo = await useAtomResult(() => todoAtom(id));
</script>

<Part data-testid="card-{id}" label="Todo {id}" tone={toneOf(todo.current)}>
  {#if todo.current._tag === "Success"}
    <p class="m-0 font-medium">{todo.current.value.title}</p>
    <Origin class="mt-2" where={todo.current.value.where} />
  {:else}
    <StateBadge result={todo.current} />
  {/if}
</Part>
