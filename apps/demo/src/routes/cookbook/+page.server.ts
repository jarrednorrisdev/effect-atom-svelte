import { Effect, Exit } from "effect";
import { AtomRegistry } from "effect/reactivity";

import { todosAtom } from "./todos.ts";

// Runs on the server, outside any component, so it makes its own registry.
export const load = async () => {
  const registry = AtomRegistry.make();
  try {
    const exit = await Effect.runPromiseExit(
      AtomRegistry.getResult(registry, todosAtom)
    );
    // A failed request leaves the count out rather than failing the page.
    return {
      todoCount: Exit.isSuccess(exit) ? exit.value.length : undefined,
    };
  } finally {
    registry.dispose();
  }
};
