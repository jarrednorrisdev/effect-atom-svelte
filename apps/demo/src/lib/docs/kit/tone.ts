/**
 * The visual states every kit component shares, after effect.kitlangton.com's tiles: gray when
 * idle, the brand accent while running, green on success, red on failure, and gray with a dashed
 * border once interrupted. The colors are the `--tone-*` variables in `app.css`.
 */

import { Cause } from "effect";
import type { AsyncResult } from "effect/reactivity";
import { getContext, setContext } from "svelte";

export type Tone = "failure" | "idle" | "interrupted" | "running" | "success";

/**
 * The tone of an `AsyncResult`: running while `waiting` with no value yet, otherwise its tag, and
 * interrupted for a Failure whose cause is only an interruption.
 */
export const toneOf = (
  result: AsyncResult.AsyncResult<unknown, unknown>
): Tone => {
  switch (result._tag) {
    case "Success": {
      return "success";
    }
    case "Failure": {
      return Cause.hasInterruptsOnly(result.cause) ? "interrupted" : "failure";
    }
    default: {
      return result.waiting ? "running" : "idle";
    }
  }
};

/** What a live example knows about the reader, shared with the kit components inside it. */
export interface ExampleState {
  /** Whether the reader has clicked or typed inside the example yet. */
  touched: boolean;
}

const key = Symbol("example");

/** Called by `example.svelte`. */
export const setExampleState = (state: ExampleState) => setContext(key, state);

/**
 * Whether outcome sounds may play: only once the reader has interacted with this example, so a
 * page's own first load stays silent. Outside an Example there is no such state, so they may.
 */
export const exampleTouched = (state: ExampleState | undefined) =>
  state?.touched ?? true;

/** The enclosing example's state, if any. Call during component init. */
export const getExampleState = () => getContext<ExampleState | undefined>(key);
