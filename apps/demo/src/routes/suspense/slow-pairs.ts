import { Data, Effect } from "effect";
import { Atom } from "effect/reactivity";

import { EventLogState } from "#lib/docs/kit/event-log.svelte.ts";

/**
 * The loads behind the "Awaiting more than one atom" example, each taking 1.5 s, with a log
 * per side for its timeline: one lane per load, a dot when it starts and when it ends. Not part
 * of the example's code.
 */
class TodosUnavailable extends Data.TaggedError("TodosUnavailable") {}

// The example's switch: the todos load fails after 0.6 seconds.
let todosFail = false;

/** Makes the todos load fail, from the next mount on. */
export const setTodosFail = (fail: boolean) => {
  todosFail = fail;
};

const side = () => {
  const log = new EventLogState();
  // Logged from a new task: a load can start while Svelte has an update in flight.
  const mark = (
    lane: string,
    label: string,
    tone: "failure" | "interrupted" | "running" | "success"
  ) =>
    Effect.sync(() => {
      setTimeout(() => log.add(label, { lane, tone }), 0);
    });
  const load = (name: string) =>
    mark(name, `${name} started`, "running").pipe(
      Effect.andThen(
        Effect.suspend(() =>
          name === "todos" && todosFail
            ? Effect.fail(new TodosUnavailable()).pipe(
                Effect.delay("600 millis")
              )
            : Effect.succeed(name).pipe(Effect.delay("1500 millis"))
        )
      ),
      Effect.tap(() => mark(name, `${name} done`, "success")),
      Effect.tapError(() => mark(name, `${name} failed`, "failure")),
      Effect.onInterrupt(() => mark(name, `${name} interrupted`, "interrupted"))
    );
  return { load, log };
};

const oneByOneSide = side();
const togetherSide = side();
const combinedSide = side();

export const oneByOne = {
  log: oneByOneSide.log,
  todosAtom: Atom.make(oneByOneSide.load("todos")),
  userAtom: Atom.make(oneByOneSide.load("user")),
};

export const together = {
  log: togetherSide.log,
  todosAtom: Atom.make(togetherSide.load("todos")),
  userAtom: Atom.make(togetherSide.load("user")),
};

// The effects themselves, for the side that combines them in one atom.
export const combined = {
  loadTodos: combinedSide.load("todos"),
  loadUser: combinedSide.load("user"),
  log: combinedSide.log,
};
