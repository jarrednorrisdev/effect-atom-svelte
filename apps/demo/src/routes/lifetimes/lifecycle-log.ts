/**
 * The log behind the lifetimes example, kept out of its code. `logged(name)` is a read function
 * for `Atom.make` that returns `name`, and logs when the registry computes the atom and when it
 * disposes of it.
 */
import { Atom } from "effect/reactivity";

export interface LifeEvent {
  readonly atom: string;
  readonly event: "computed" | "disposed";
}

// The log is an atom too. The example's log and boxes read it for as long as they live.
export const logAtom = Atom.make<readonly LifeEvent[]>([]);

export const logged =
  (name: string) =>
  (get: Atom.AtomContext): string => {
    // Finalizers run after the atom is disposed, so write through the registry.
    const log = (event: LifeEvent["event"]) =>
      get.registry.update(logAtom, (events) => [
        ...events,
        { atom: name, event },
      ]);
    log("computed");
    get.addFinalizer(() => log("disposed"));
    return name;
  };
