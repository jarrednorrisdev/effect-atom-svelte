import { Atom } from "effect/reactivity";

export const logAtom = Atom.make<readonly { atom: string; event: string }[]>([]);

let opened = 0;

// Stands in for a chat connection: opened when computed, closed when disposed.
export const socketAtom = Atom.make((get) => {
  opened += 1;
  const connection = opened;
  const log = (event: string) =>
    get.registry.update(logAtom, (events) => [
      ...events,
      { atom: "socketAtom", event: `connection ${connection} ${event}` },
    ]);
  log("opened");
  get.addFinalizer(() => log("closed"));
  return connection;
});
