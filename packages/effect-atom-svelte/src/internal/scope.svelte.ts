// What the hooks tell an inspector scope (`provideInspectorScope` in ../Inspector.ts): which atoms a
// part of the component tree reads, and which component reads each.
//
// The hooks only look for a scope in context, in the browser. Without one they do
// nothing more than before; the scope's own work lives in ../Inspector.ts, which only tools import.
import type { Atom, AtomRegistry } from "effect/reactivity";
import { BROWSER } from "esm-env";
import { createContext } from "svelte";

/** How a hook uses its atom: reads it, holds it mounted, subscribes to it, or writes it. */
export type ReadKind = "read" | "mount" | "subscribe" | "write";

/** A component, as the atomLabels plugin names it: `Counter`, from `/src/routes/counter.svelte`. */
export interface ComponentName {
  readonly name: string;
  readonly file: string | undefined;
  /** One per instance of the component, so two `<Counter>`s are told apart. */
  readonly instance: number;
}

/** What a scope takes from the hooks. */
export interface Reporter {
  /** A hook started using `atom`; returns the function to call when it stops. */
  readonly report: (read: {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly atom: Atom.Atom<unknown>;
    readonly kind: ReadKind;
    readonly component: ComponentName | undefined;
  }) => () => void;
}

const [getReporter, setReporter, hasReporter] = createContext<Reporter>();
const [getComponent, setComponent, hasComponent] =
  createContext<ComponentName>();

export { setReporter };

let instances = 0;

/** Names the component being set up, for the scopes its hooks report to. */
export const nameComponent = (name: string, file?: string): void => {
  instances += 1;
  setComponent({ file, instance: instances, name });
};

/**
 * Reports the atom a hook uses, following its getter, while the component lives. Called while the
 * hook sets up; adds an effect only in the browser, and only under a scope.
 */
export const reportReads = (
  registry: AtomRegistry.AtomRegistry,
  getAtom: () => Atom.Atom<unknown>,
  kind: ReadKind
): void => {
  if (!BROWSER || !hasReporter()) {
    return;
  }
  const reporter = getReporter();
  const component = hasComponent() ? getComponent() : undefined;
  $effect(() =>
    reporter.report({ atom: getAtom(), component, kind, registry })
  );
};
