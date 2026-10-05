/**
 * Counts the requests a query atom makes from the browser: each time its result starts waiting.
 * A result the server rendered counts none, so after hydration the count starts at 0. Follows
 * whichever atom the getter returns, as the hooks do.
 *
 * ```ts
 * const requests = new RequestCount(() => todosAtom);
 * // <Part count={requests.current} countLabel="requests" …>
 * ```
 *
 * It subscribes in the registry rather than reading the result in an effect: a list awaited in
 * markup holds back its updates until the new value is there, and by then it has stopped waiting.
 * For the same reason, a getter that moves to another atom is only seen once that atom has loaded,
 * so moving counts as a request: a query atom nothing was reading fetches when it is read.
 */

import type { Atom, AsyncResult } from "effect/reactivity";
import { getRegistry } from "effect-atom-svelte";

type Query = Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>;

export class RequestCount {
  current = $state(0);

  constructor(atom: () => Query) {
    const registry = getRegistry();
    // Counted in a task of its own, outside any update Svelte has in flight.
    const count = () => {
      setTimeout(() => {
        this.current += 1;
      }, 0);
    };
    let first = true;
    $effect(() => {
      const query = atom();
      let { waiting } = registry.get(query);
      if (waiting || !first) {
        count();
      }
      first = false;
      return registry.subscribe(query, (result) => {
        if (result.waiting && !waiting) {
          count();
        }
        ({ waiting } = result);
      });
    });
  }
}
