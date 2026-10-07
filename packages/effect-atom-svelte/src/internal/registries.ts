// The registries an app has in the browser during development, for developer tools to find
// (`registries` and `watchRegistries` in ../Inspector.ts). provideRegistry and the default browser
// registry add theirs here; nothing else happens until a tool asks, so this is all an app pays.
import type { AtomRegistry } from "effect/reactivity";

// How many providers hold each registry: one passed to several providers stays until all unmount.
const holders = new Map<AtomRegistry.AtomRegistry, number>();
const watchers = new Set<
  (registries: readonly AtomRegistry.AtomRegistry[]) => void
>();

export const list = (): readonly AtomRegistry.AtomRegistry[] => [
  ...holders.keys(),
];

const announce = () => {
  const registries = list();
  for (const watcher of watchers) {
    watcher(registries);
  }
};

/** Adds a registry to the list; returns the function that takes it off again. */
export const track = (registry: AtomRegistry.AtomRegistry): (() => void) => {
  holders.set(registry, (holders.get(registry) ?? 0) + 1);
  announce();
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    const count = (holders.get(registry) ?? 1) - 1;
    if (count === 0) {
      holders.delete(registry);
    } else {
      holders.set(registry, count);
    }
    announce();
  };
};

/** Calls `f` with the list now and whenever it changes; returns the function that stops it. */
export const watch = (
  f: (registries: readonly AtomRegistry.AtomRegistry[]) => void
): (() => void) => {
  watchers.add(f);
  f(list());
  return () => {
    watchers.delete(f);
  };
};
