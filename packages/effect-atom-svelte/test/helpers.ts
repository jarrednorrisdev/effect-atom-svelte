import { Effect } from "effect";
import type { Duration } from "effect";
import { Atom } from "effect/reactivity";
import type { render } from "vitest-browser-svelte";

/** Trimmed text of a rendered component, as a function for expect.poll. */
export const text = (screen: Awaited<ReturnType<typeof render>>) => () =>
  screen.container.textContent?.trim();

export const sleep = (duration: Duration.Input) =>
  Effect.runPromise(Effect.sleep(duration));

/** An atom that logs when it is computed and when it is disposed. */
export const tracked = (log: string[], name = "") =>
  Atom.make((get) => {
    log.push(name ? `start ${name}` : "start");
    get.addFinalizer(() => log.push(name ? `stop ${name}` : "stop"));
    return 1;
  });
