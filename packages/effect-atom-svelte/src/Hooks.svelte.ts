/**
 * Hooks that read, write and await atoms from Svelte 5 components.
 *
 * @since 0.1.0
 */
import { Cause, Effect, Exit } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import type { AtomRef } from "effect/reactivity";
import { BROWSER } from "esm-env";
import { getAbortSignal, hydratable, onDestroy, untrack } from "svelte";
import { createSubscriber } from "svelte/reactivity";

import { revalidatesOnHydrate } from "./internal/hydration.ts";
import { getRegistry } from "./RegistryContext.ts";

/**
 * An atom, or a getter so the hook follows the atom when reactive state picks a different one.
 *
 * @stability unstable
 * @since 0.1.0
 * @category models
 */
export type AtomInput<A> = A | (() => A);

/**
 * A reactive read-only value. Read `.current` in a template, `$derived` or `$effect` to track it.
 *
 * @stability unstable
 * @since 0.1.0
 * @category models
 */
export interface AtomValue<A> {
  readonly current: A;
}

/**
 * A reactive value that can also be assigned, so `bind:value={state.current}` works.
 *
 * @stability unstable
 * @since 0.1.0
 * @category models
 */
export interface AtomState<R, W = R> {
  get current(): R;
  set current(value: W);
}

/**
 * How a setter from `useAtomSet` reports back: not at all, with the result, or with the `Exit`.
 *
 * @stability unstable
 * @since 0.1.0
 * @category models
 */
export type WriteMode = "value" | "promise" | "promiseExit";

/**
 * Options for a promise-mode setter call.
 *
 * @stability unstable
 * @since 0.1.0
 * @category models
 */
export interface WriteOptions {
  readonly signal?: AbortSignal | undefined;
}

const toGetter = <A>(input: AtomInput<A>): (() => A) =>
  typeof input === "function" && !Atom.isAtom(input)
    ? (input as () => A)
    : () => input as A;

// The registry notifies subscribers synchronously while it computes an atom, and Svelte throws
// state_unsafe_mutation if state changes while a template or $derived is evaluating. Reads are
// counted, and a notification raised during one is delivered on a microtask instead. Outside a
// read, notifications stay synchronous so writes from event handlers update in the same tick.
let activeReads = 0;

const notifyAfterReads = (update: () => void) => () => {
  if (activeReads > 0) {
    queueMicrotask(update);
  } else {
    update();
  }
};

const duringRead = <A>(f: () => A): A => {
  activeReads += 1;
  try {
    return f();
  } finally {
    activeReads -= 1;
  }
};

/** Holds read and write closures; a class so `.current` is a real accessor `bind:` can use. */
class AtomCell<R, W> {
  readonly #read: () => R;
  readonly #write: (value: W) => void;

  constructor(read: () => R, write: (value: W) => void) {
    this.#read = read;
    this.#write = write;
  }

  get current(): R {
    return this.#read();
  }

  set current(value: W) {
    this.#write(value);
  }
}

const readOnly = (): never => {
  throw new Error("This atom value is read-only");
};

const valueOrThrow = <A, E>(exit: Exit.Exit<A, E>): A => {
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }
  throw Cause.squash(exit.cause);
};

/**
 * Whether the atom has a `withServerValue` override. The server reads that instead and never
 * computes the atom, as its real read is often browser-only.
 */
const hasServerValue = (atom: Atom.Atom<unknown>): boolean =>
  Atom.ServerValueTypeId in atom;

const awaitResult = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  options?: { readonly suspendOnWaiting?: boolean | undefined },
  signal?: AbortSignal | undefined
): Promise<Exit.Exit<A, E>> =>
  Effect.runPromiseExit(AtomRegistry.getResult(registry, atom, options), {
    signal,
  });

/** A subscription a reader holds on after switching away from its atom. */
interface KeptSubscription<A> {
  readonly atom: Atom.Atom<A>;
  readonly cancel: () => void;
}

const subscribedReader = <A>(
  registry: AtomRegistry.AtomRegistry,
  getAtom: () => Atom.Atom<A>
): (() => A) => {
  if (!BROWSER) {
    // Nothing subscribes during SSR, so without a mount the registry would sweep the node while the
    // render awaits, losing initial values and refetching async atoms. Mounting at setup, before any
    // await, keeps it for the request. The mounts are released in onDestroy, which runs when the
    // server render ends, because a registry passed in by the caller outlives the request (JND-17).
    // An atom with a withServerValue override is never computed on the server, so it is not mounted:
    // mounting would run its real read, which is often browser-only.
    const releases: (() => void)[] = [];
    onDestroy(() => {
      for (const release of releases) {
        release();
      }
    });
    const mount = (atom: Atom.Atom<A>) => {
      if (!hasServerValue(atom)) {
        releases.push(registry.mount(atom));
      }
      return atom;
    };
    let mounted = mount(getAtom());
    return () => {
      const atom = getAtom();
      if (atom !== mounted) {
        mounted = mount(atom);
      }
      return Atom.getServerValue(atom, registry);
    };
  }
  // The atom is picked on every read, not held in a $derived. In async mode Svelte renders a batch
  // with other pending batches' changes rolled back, deriveds included, but registry reads always
  // see the latest state; a derived atom could then pair an old atom with new state, and that
  // render could commit last and stick (JND-23). One subscription follows whichever atom was read.
  let atom: Atom.Atom<A> | undefined;
  let notify: (() => void) | undefined;
  let cancel: (() => void) | undefined;
  // The atom the last commit picked. When a read switches away from it, its subscription is kept
  // until a commit picks another: a render with the switch rolled back reads it again, and a
  // released atom would compute again (JND-35). Atoms no commit picked are released at once, so an
  // abandoned pending atom is still interrupted (JND-16).
  let committed: Atom.Atom<A> | undefined;
  let kept: KeptSubscription<A> | undefined;
  const releaseKept = () => {
    kept?.cancel();
    kept = undefined;
  };
  $effect(() => {
    committed = getAtom();
    if (kept && kept.atom !== committed) {
      releaseKept();
    }
  });
  const follow = (current: Atom.Atom<A>) => {
    if (kept?.atom === current) {
      const { cancel: keptCancel } = kept;
      kept = undefined;
      return keptCancel;
    }
    return notify ? registry.subscribe(current, notify) : undefined;
  };
  const subscribe = createSubscriber((update) => {
    notify = notifyAfterReads(update);
    cancel = atom ? follow(atom) : undefined;
    return () => {
      cancel?.();
      cancel = undefined;
      releaseKept();
      notify = undefined;
    };
  });
  return () =>
    duringRead(() => {
      const current = getAtom();
      if (current !== atom) {
        const previous = atom;
        const previousCancel = cancel;
        atom = current;
        cancel = follow(current);
        if (
          previous === committed &&
          previous !== undefined &&
          previousCancel
        ) {
          releaseKept();
          kept = { atom: previous, cancel: previousCancel };
        } else {
          previousCancel?.();
        }
      }
      subscribe();
      return registry.get(current);
    });
};

/**
 * Reads an atom, optionally through a transform. The atom stays mounted while something reactive
 * reads `.current`, and is released when nothing does.
 *
 * **Example** (Reading an atom through a transform)
 *
 * ```ts
 * import { useAtomValue } from "effect-atom-svelte";
 * import { countAtom } from "./atoms.ts";
 *
 * const doubled = useAtomValue(countAtom, (count) => count * 2);
 * // In the markup: {doubled.current}
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category hooks
 */
export function useAtomValue<A>(input: AtomInput<Atom.Atom<A>>): AtomValue<A>;
export function useAtomValue<A, B>(
  input: AtomInput<Atom.Atom<A>>,
  f: (value: A) => B
): AtomValue<B>;
export function useAtomValue<A, B>(
  input: AtomInput<Atom.Atom<A>>,
  f?: (value: A) => B
): AtomValue<A | B> {
  const read = subscribedReader(getRegistry(), toGetter(input));
  return new AtomCell<A | B, never>(f ? () => f(read()) : read, readOnly);
}

/**
 * Reads and writes a writable atom through `.current`, so `bind:value={state.current}` works.
 *
 * **Example** (Binding an input to an atom)
 *
 * ```ts
 * import { useAtom } from "effect-atom-svelte";
 * import { nameAtom } from "./atoms.ts";
 *
 * const name = useAtom(nameAtom);
 * // In the markup: <input bind:value={name.current} />
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category hooks
 */
export const useAtom = <R, W>(
  input: AtomInput<Atom.Writable<R, W>>
): AtomState<R, W> => {
  const registry = getRegistry();
  const getAtom = toGetter(input);
  return new AtomCell<R, W>(subscribedReader(registry, getAtom), (value) =>
    registry.set(getAtom(), value)
  );
};

/**
 * Keeps an atom mounted while the component lives, without reading it.
 *
 * **Example** (Keeping a connection open while a component lives)
 *
 * ```ts
 * import { useAtomMount } from "effect-atom-svelte";
 * import { socketAtom } from "./atoms.ts";
 *
 * // Not disposed while this component lives, even though nothing reads it.
 * useAtomMount(socketAtom);
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category hooks
 */
export const useAtomMount = (input: AtomInput<Atom.Atom<unknown>>): void => {
  const registry = getRegistry();
  const getAtom = toGetter(input);
  $effect(() => registry.mount(getAtom()));
};

/**
 * Returns a setter. The atom is mounted for the component's lifetime, so an `Atom.fn` keeps its
 * state between calls and is not disposed between set and read. In `promise` and `promiseExit`
 * modes the setter waits for the atom's next settled result.
 *
 * **Example** (Updating an atom from its current value)
 *
 * ```ts
 * import { useAtomSet } from "effect-atom-svelte";
 * import { countAtom } from "./atoms.ts";
 *
 * const setCount = useAtomSet(countAtom);
 * // In the markup: <button onclick={() => setCount((n) => n + 1)}>+</button>
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category hooks
 */
export function useAtomSet<R, W>(
  input: AtomInput<Atom.Writable<R, W>>,
  options?: { readonly mode?: "value" | undefined }
): (value: W | ((current: R) => W)) => void;
export function useAtomSet<A, E, W>(
  input: AtomInput<Atom.Writable<AsyncResult.AsyncResult<A, E>, W>>,
  options: { readonly mode: "promise" }
): (value: W, options?: WriteOptions) => Promise<A>;
export function useAtomSet<A, E, W>(
  input: AtomInput<Atom.Writable<AsyncResult.AsyncResult<A, E>, W>>,
  options: { readonly mode: "promiseExit" }
): (value: W, options?: WriteOptions) => Promise<Exit.Exit<A, E>>;
export function useAtomSet<A, E, W>(
  input: AtomInput<Atom.Writable<AsyncResult.AsyncResult<A, E>, W>>,
  options?: { readonly mode?: WriteMode | undefined }
): (
  value: W,
  options?: WriteOptions
) => undefined | Promise<A> | Promise<Exit.Exit<A, E>>;
export function useAtomSet(
  input: AtomInput<Atom.Writable<unknown, unknown>>,
  options?: { readonly mode?: WriteMode | undefined }
) {
  const registry = getRegistry();
  const getAtom = toGetter(input);
  useAtomMount(getAtom);
  const mode = options?.mode ?? "value";

  if (mode === "value") {
    return (value: unknown) => {
      const atom = getAtom();
      registry.set(
        atom,
        typeof value === "function"
          ? (value as (current: unknown) => unknown)(registry.get(atom))
          : value
      );
    };
  }
  return async (value: unknown, writeOptions?: WriteOptions) => {
    const atom = getAtom() as Atom.Writable<
      AsyncResult.AsyncResult<unknown, unknown>,
      unknown
    >;
    registry.set(atom, value);
    const exit = await awaitResult(
      registry,
      atom,
      { suspendOnWaiting: true },
      writeOptions?.signal
    );
    return mode === "promiseExit" ? exit : valueOrThrow(exit);
  };
}

/**
 * Returns a function that recomputes the atom. The atom is mounted so the refresh is not lost.
 *
 * **Example** (Running an atom again on click)
 *
 * ```ts
 * import { useAtomRefresh } from "effect-atom-svelte";
 * import { dieAtom } from "./atoms.ts";
 *
 * const roll = useAtomRefresh(dieAtom);
 * // In the markup: <button onclick={roll}>Roll</button>
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category hooks
 */
export const useAtomRefresh = (
  input: AtomInput<Atom.Atom<unknown>>
): (() => void) => {
  const registry = getRegistry();
  const getAtom = toGetter(input);
  useAtomMount(getAtom);
  return () => registry.refresh(getAtom());
};

/**
 * Calls `f` on every change while the component lives, and with the current value first when
 * `immediate` is set.
 *
 * **Example** (Saving every change)
 *
 * ```ts
 * import { useAtomSubscribe } from "effect-atom-svelte";
 * import { draftAtom } from "./atoms.ts";
 *
 * useAtomSubscribe(draftAtom, (draft) => localStorage.setItem("draft", draft));
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category hooks
 */
export const useAtomSubscribe = <A>(
  input: AtomInput<Atom.Atom<A>>,
  f: (value: A) => void,
  options?: { readonly immediate?: boolean | undefined }
): void => {
  const registry = getRegistry();
  const getAtom = toGetter(input);
  $effect(() => {
    const atom = getAtom();
    // `immediate` calls `f` now, inside this effect; what `f` reads must not re-run it.
    return untrack(() =>
      registry.subscribe(atom, f, { immediate: options?.immediate === true })
    );
  });
};

/**
 * Gives an atom a value without computing it. The public registry can only queue a value for an
 * atom's next read; this sets it on the node now, which is valid, so nothing reads it again.
 */
const setNodeValue = (
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<unknown>,
  value: unknown
): void => {
  // SAFETY: ensureNode is on the registry implementation, not the interface (Effect 4.0.0);
  // @effect/atom-react uses it the same way.
  (
    registry as unknown as {
      ensureNode: (atom: Atom.Atom<unknown>) => {
        setValue: (value: unknown) => void;
      };
    }
  )
    .ensureNode(atom)
    .setValue(value);
};

const initialValuesApplied = new WeakMap<
  AtomRegistry.AtomRegistry,
  WeakSet<Atom.Atom<unknown>>
>();

/**
 * Sets starting values once per registry, before anything reads the atoms.
 *
 * **Example** (Starting an atom from a prop)
 *
 * ```ts
 * import { useAtomInitialValues, useAtomValue } from "effect-atom-svelte";
 * import { countAtom } from "./atoms.ts";
 *
 * const { start } = $props();
 * useAtomInitialValues([[countAtom, start]]);
 * const count = useAtomValue(countAtom);
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category hooks
 */
export const useAtomInitialValues = (
  initialValues: Iterable<readonly [Atom.Atom<unknown>, unknown]>
): void => {
  const registry = getRegistry();
  let applied = initialValuesApplied.get(registry);
  if (!applied) {
    applied = new WeakSet();
    initialValuesApplied.set(registry, applied);
  }
  for (const [atom, value] of initialValues) {
    if (!applied.has(atom)) {
      applied.add(atom);
      setNodeValue(registry, atom, value);
    }
  }
};

/**
 * Reads an `AtomRef`, following it when the getter returns a different ref.
 *
 * **Example** (Reading a ref)
 *
 * ```ts
 * import { useAtomRef } from "effect-atom-svelte";
 * import { profile } from "./refs.ts";
 *
 * const current = useAtomRef(profile);
 * // In the markup: {current.current.name}
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category hooks
 */
export const useAtomRef = <A>(
  input: AtomInput<AtomRef.ReadonlyRef<A>>
): AtomValue<A> => {
  const getRef = toGetter(input);
  if (!BROWSER) {
    return new AtomCell<A, never>(() => getRef().value, readOnly);
  }
  const ref = $derived(getRef());
  const subscribe = $derived.by(() => {
    const current = ref;
    return createSubscriber((update) =>
      current.subscribe(notifyAfterReads(update))
    );
  });
  return new AtomCell<A, never>(
    () =>
      duringRead(() => {
        subscribe();
        return ref.value;
      }),
    readOnly
  );
};

/**
 * Returns the `AtomRef` for one property of an `AtomRef`.
 *
 * **Example** (Writing one property of a ref)
 *
 * ```ts
 * import { useAtomRefProp } from "effect-atom-svelte";
 * import { profile } from "./refs.ts";
 *
 * const name = useAtomRefProp(profile, "name");
 * const rename = (next: string) => name.set(next); // profile.value.name changes too
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category hooks
 */
export const useAtomRefProp = <A, K extends keyof A>(
  ref: AtomRef.AtomRef<A>,
  prop: K
): AtomRef.AtomRef<A[K]> => ref.prop(prop);

/**
 * Reads one property of an `AtomRef`.
 *
 * **Example** (Reading one property of a ref)
 *
 * ```ts
 * import { useAtomRefPropValue } from "effect-atom-svelte";
 * import { profile } from "./refs.ts";
 *
 * const name = useAtomRefPropValue(profile, "name");
 * // In the markup: {name.current}
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category hooks
 */
export const useAtomRefPropValue = <A, K extends keyof A>(
  input: AtomInput<AtomRef.AtomRef<A>>,
  prop: K
): AtomValue<A[K]> => {
  const getRef = toGetter(input);
  const propRef = $derived(getRef().prop(prop));
  return useAtomRef(() => propRef);
};

// ---------------------------------------------------------------------------------------------
// Async: experimental async components, SSR and hydration
//
// Each hook does its context work (registry lookup, subscriptions, teardowns) synchronously, before
// its own first await, so it works anywhere Svelte has restored component context: at the top level
// of a component script, including after earlier top-level awaits.
// ---------------------------------------------------------------------------------------------

/**
 * Runs `f` when the component is destroyed, even while its script is still awaiting. In the browser
 * `onDestroy` only takes effect once the component mounts, so a component removed while pending
 * would never call it. A pre effect runs during init and is torn down with the component (JND-16).
 * On the server, `onDestroy` runs when the render ends.
 */
const onTeardown = (f: () => void): void => {
  if (BROWSER) {
    $effect.pre(() => f);
  } else {
    onDestroy(f);
  }
};

// Internal shorthand; exported signatures spell the type out so the API reference shows it.
type ResultAtom<A, E> = Atom.Atom<AsyncResult.AsyncResult<A, E>>;

/** One serialization key's seed in a registry, shared by every component using that key. */
interface Seed {
  readonly atom: Atom.Atom<unknown>;
  readonly done: Promise<void>;
  /**
   * Counts a component using the key until it calls the returned release, and whether it wants the
   * atom fetched again once seeded.
   */
  readonly hold: (revalidate: boolean) => () => void;
}

/**
 * Puts the server's value in the registry as current, so nothing fetches it again (JND-19). Seeding
 * through `setSerializable` would not: for an atom that wraps another, such as a query with
 * reactivity keys, the registry seeds the inner atom but marks it stale, and building it to wire up
 * reactivity starts the request again. The value goes on the innermost atom, where the registry
 * would put it, so the wrapper still builds and wires up on first read.
 */
const applySeed = (
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<unknown>,
  value: unknown,
  revalidate: boolean
): void => {
  let target = atom;
  while (target.initialValueTarget) {
    target = target.initialValueTarget;
  }
  setNodeValue(registry, target, value);
  // Released at once, so the registry sweeps the node if the atom is not mounted soon.
  registry.mount(target)();
  if (revalidate) {
    registry.refresh(target);
  }
};

/**
 * A registry's seeds in the browser. A key is held while a component uses it, then spent: its
 * server value is never applied again, as it would be however old by then (JND-37). Only the key is
 * kept, not the atom, so a spent atom can be collected and a new atom can reuse the key, as when a
 * component creates its atom or HMR re-runs the module that defines it (JND-60).
 */
interface Seeds {
  readonly held: Map<string, Seed>;
  readonly spent: Set<string>;
}

const seeds = new WeakMap<AtomRegistry.AtomRegistry, Seeds>();

// hydratable returns one promise per key per render, so it identifies the atom that claimed a key.
const serverSeeds = new WeakMap<Promise<unknown>, Atom.Atom<unknown>>();

/**
 * On the server each request seeds for itself: `hydratable` already shares one result per key
 * within a render, and a per-registry record would outlive the request when the caller owns the
 * registry, so later requests would skip embedding their seed (JND-17).
 */
const seedOnServer = (
  registry: AtomRegistry.AtomRegistry,
  atom: ResultAtom<unknown, unknown>,
  key: string,
  encode: (value: AsyncResult.AsyncResult<unknown, unknown>) => unknown
): Promise<void> => {
  // Mounted until the render ends, so the settled node is what the render reads.
  const release = registry.mount(atom);
  onDestroy(release);
  const encoded = hydratable(key, async () => {
    await awaitResult(registry, atom);
    return encode(registry.get(atom));
  });
  const claimed = serverSeeds.get(encoded);
  if (claimed && claimed !== atom) {
    throw new Error(`Two different atoms share the serialization key "${key}"`);
  }
  serverSeeds.set(encoded, atom);
  return (async () => {
    await encoded;
  })();
};

/**
 * For the getter's first atom, if serializable, resolves it and passes the encoded result from
 * server to client with `hydratable`, so hydration seeds the registry instead of fetching again.
 * Must run synchronously during component init. Returns undefined for atoms without a
 * serialization key. The atom is fetched again once seeded if any component using the key then
 * asked to revalidate.
 */
const seedFromServer = (
  registry: AtomRegistry.AtomRegistry,
  getAtom: () => ResultAtom<unknown, unknown>,
  revalidateOption: boolean | undefined
): Promise<void> | undefined => {
  const atom = getAtom();
  // The server never computes an atom with a server value, so it has no value to pass on, and the
  // browser must not ask for one: hydratable throws for a key the server didn't write (JND-58).
  if (!Atom.isSerializable(atom) || hasServerValue(atom)) {
    return undefined;
  }
  const { decode, encode, key } = atom[Atom.SerializableTypeId];
  if (!BROWSER) {
    return seedOnServer(registry, atom, key, encode);
  }
  const revalidate = revalidatesOnHydrate(revalidateOption);
  let registrySeeds = seeds.get(registry);
  if (!registrySeeds) {
    registrySeeds = { held: new Map(), spent: new Set() };
    seeds.set(registry, registrySeeds);
  }
  const { held, spent } = registrySeeds;
  let entry = held.get(key);
  if (entry && entry.atom !== atom) {
    throw new Error(`Two different atoms share the serialization key "${key}"`);
  }
  if (!entry && spent.has(key)) {
    return undefined;
  }
  if (!entry) {
    // hydratable runs this only when it has no value from the server, as after client-side
    // navigation. It fetches nothing: the hook fetches the atom itself, with a wait that is
    // interrupted when the component goes away (JND-57). A wait here would hold the atom until
    // its request finished.
    let computedHere = false;
    const encoded = hydratable(key, (): unknown => {
      computedHere = true;
      return undefined;
    });
    let holders = 0;
    let revalidating = 0;
    entry = {
      atom,
      done: (async () => {
        const value = await encoded;
        // Only the server's value is a seed, and only while someone is there to read it now: a seed
        // set later would show data however old by then (JND-37).
        if (!computedHere && holders > 0) {
          applySeed(registry, atom, decode(value), revalidating > 0);
        }
      })(),
      hold: (wantsRevalidate) => {
        const counted = wantsRevalidate ? 1 : 0;
        holders += 1;
        revalidating += counted;
        return () => {
          holders -= 1;
          revalidating -= counted;
          if (holders === 0) {
            held.delete(key);
            spent.add(key);
          }
        };
      },
    };
    held.set(key, entry);
  }
  // Every caller holds the atom until it is destroyed, not only the first, which may go first and
  // leave the others' seed to be swept (JND-36). It is mounted only once the seed is in: the
  // seed must be in before the atom first computes, or mounting would fetch what hydration is about
  // to provide.
  const { done } = entry;
  const unhold = entry.hold(revalidate);
  let release: (() => void) | undefined;
  let left = false;
  const leave = () => {
    if (!left) {
      left = true;
      unhold();
      release?.();
    }
  };
  onTeardown(leave);
  // A committed switch to another atom lets go too: the hook's own subscription follows the getter,
  // and this mount would keep the old atom running for nobody (JND-59).
  $effect(() => {
    if (getAtom() !== atom) {
      leave();
    }
  });
  return (async () => {
    await done;
    if (!left) {
      release = registry.mount(atom);
    }
  })();
};

/**
 * Options for `useAtomResult`.
 *
 * @stability unstable
 * @since 0.1.0
 * @category models
 */
export interface ResultOptions {
  /** Treat a refreshing result as pending, so the first await also waits for the refresh. */
  readonly suspendOnWaiting?: boolean | undefined;
  /**
   * Fetch a server-rendered atom again once hydration is done. Overrides `RegistryProvider`'s
   * `revalidateOnHydrate`, which defaults to `false`.
   */
  readonly revalidateOnHydrate?: boolean | undefined;
}

/**
 * Awaits an async atom's first result, then returns a live handle to its `AsyncResult`. Use it as
 * a top-level `await` in a component script; SSR waits for it, and with a serialization key the
 * result is reused during hydration instead of fetched again. With a getter, only the first atom
 * is awaited: when the getter picks another atom the handle follows it, starting from that atom's
 * current result (often `Initial`), and the component's await does not run again. On the server,
 * an atom with a `withServerValue` override reads as that value and is never computed.
 *
 * **Example** (Awaiting an atom picked by a prop)
 *
 * ```ts
 * import { useAtomResult } from "effect-atom-svelte";
 * import { todoAtom } from "./atoms.ts";
 *
 * const { id } = $props();
 * const todo = await useAtomResult(() => todoAtom(id));
 * // todo.current is the AsyncResult, a Success or a Failure by now
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category async
 */
export const useAtomResult = async <A, E>(
  input: AtomInput<Atom.Atom<AsyncResult.AsyncResult<A, E>>>,
  options?: ResultOptions
): Promise<AtomValue<AsyncResult.AsyncResult<A, E>>> => {
  const registry = getRegistry();
  const getAtom = toGetter(input);
  const value = useAtomValue(getAtom);
  const atom = getAtom();
  let release: (() => void) | undefined;
  // Aborted when the component is destroyed, which interrupts the wait below so the atom is not held.
  const lifetime = new AbortController();
  onTeardown(() => {
    lifetime.abort();
    release?.();
  });
  // Later atoms are mounted by this effect, which runs once the component mounts, so after the
  // await below. The first atom's mount is released then, as the effect holds it from there.
  $effect(() => {
    const unmount = registry.mount(getAtom());
    release?.();
    release = undefined;
    return unmount;
  });
  const seed = seedFromServer(registry, getAtom, options?.revalidateOnHydrate);
  if (seed) {
    await seed;
  }
  // Destroyed while seeding: reading the atom now would only compute it for nobody. On the server,
  // an atom with a server value is read as that value, with nothing to wait for.
  if (lifetime.signal.aborted || (!BROWSER && hasServerValue(atom))) {
    return value;
  }
  // Mounted only after seeding, so hydration's value is in place before the atom first computes.
  release = registry.mount(atom);
  await awaitResult(registry, atom, options, lifetime.signal);
  return value;
};

/**
 * Options for `useAtomSuspense`.
 *
 * @stability unstable
 * @since 0.1.0
 * @category models
 */
export interface SuspenseOptions {
  /**
   * Treat a refreshing result as pending, so `await` waits for the refreshed value instead of
   * resolving with the current one. The boundary keeps showing its content meanwhile; use
   * `$effect.pending()` to show progress.
   */
  readonly suspendOnWaiting?: boolean | undefined;
  /** Resolve with the Success or Failure result instead of the value, rather than rejecting. */
  readonly includeFailure?: boolean | undefined;
  /**
   * Fetch a server-rendered atom again once hydration is done. Overrides `RegistryProvider`'s
   * `revalidateOnHydrate`, which defaults to `false`.
   */
  readonly revalidateOnHydrate?: boolean | undefined;
}

/** Whether the hook waits for a result: it is `Initial`, or refreshing with `suspendOnWaiting`. */
const isPending = <A, E>(
  current: AsyncResult.AsyncResult<A, E>,
  options: SuspenseOptions
): boolean =>
  current._tag === "Initial" ||
  (options.suspendOnWaiting === true && current.waiting);

/** What the promise resolves with, or the error it rejects with, for a result that is not pending. */
const fromSettled = <A, E>(
  current: AsyncResult.AsyncResult<A, E>,
  options: SuspenseOptions
): unknown => {
  if (current._tag === "Success") {
    return options.includeFailure ? current : current.value;
  }
  if (current._tag === "Failure" && !options.includeFailure) {
    throw Cause.squash(current.cause);
  }
  return current;
};

/**
 * On the server, an atom with a server value resolves from that value and is never computed. An
 * `Initial` server value, as from `withServerValueInitial`, has nothing to resolve with, and waiting
 * would hang the render, so it rejects with what to do instead (JND-58).
 */
const fromServerValue = <A, E>(
  current: AsyncResult.AsyncResult<A, E>,
  options: SuspenseOptions
): Promise<unknown> => {
  if (isPending(current, options)) {
    return Promise.reject(
      new Error(
        "useAtomSuspense read an atom whose server value is pending, so the server has nothing to render. Read it inside a <svelte:boundary> with a pending snippet, which the server renders instead, or use useAtomResult."
      )
    );
  }
  try {
    return Promise.resolve(fromSettled(current, options));
  } catch (error) {
    return Promise.reject(error);
  }
};

const suspend = async <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: ResultAtom<A, E>,
  current: AsyncResult.AsyncResult<A, E>,
  options: SuspenseOptions,
  signal: AbortSignal
): Promise<unknown> => {
  if (isPending(current, options)) {
    const exit = await awaitResult(
      registry,
      atom,
      { suspendOnWaiting: options.suspendOnWaiting },
      signal
    );
    // Abandoned: rejects with the reason its last reader's signal was aborted with. For a re-run
    // that is Svelte's STALE_REACTION, which it ignores, so a pending render that still awaits this
    // wait keeps waiting for its next run instead of showing the interruption (JND-22).
    signal.throwIfAborted();
    if (options.includeFailure) {
      return Exit.isSuccess(exit)
        ? AsyncResult.success(exit.value)
        : AsyncResult.failure(exit.cause);
    }
    return valueOrThrow(exit);
  }
  return fromSettled(current, options);
};

/** The derived or effect reading now's abort signal, which Svelte aborts when it re-runs or is destroyed. */
const readerSignal = (): AbortSignal | undefined => {
  if (!BROWSER) {
    return undefined;
  }
  try {
    return getAbortSignal();
  } catch {
    return undefined;
  }
};

/** A wait shared by every read of one result; each reader holds it until its signal aborts. */
interface SharedWait {
  readonly promise: Promise<unknown>;
  readonly hold: (signal: AbortSignal) => void;
}

/**
 * Once no reader holds a pending wait, it is interrupted so it stops holding the atom, which lets
 * the registry dispose it and interrupt its request (JND-16), and `onAbandoned` drops it from the
 * cache. A settled wait is kept, so its promise stays the same for the next reader.
 */
const sharedWait = (
  start: (signal: AbortSignal) => Promise<unknown>,
  onAbandoned: () => void
): SharedWait => {
  const controller = new AbortController();
  const promise = start(controller.signal);
  let settled = false;
  void (async () => {
    try {
      await promise;
    } catch {
      // Rejections belong to the awaiting template; this stops an unread one being reported as unhandled.
    }
    settled = true;
  })();
  let holders = 0;
  // Each signal holds once: reads outside a reaction all share the component's lifetime signal, and
  // would otherwise add a holder and a listener per read until it is destroyed (JND-59).
  const held = new WeakSet<AbortSignal>();
  const release = (reason: unknown) => {
    holders -= 1;
    // A reaction aborts its signal before it re-runs, so wait a microtask: the re-run may read the
    // same result again and hold the wait instead of starting a new one.
    queueMicrotask(() => {
      if (holders === 0 && !settled && !controller.signal.aborted) {
        controller.abort(reason);
        onAbandoned();
      }
    });
  };
  return {
    hold: (signal) => {
      if (signal.aborted || held.has(signal)) {
        return;
      }
      held.add(signal);
      holders += 1;
      signal.addEventListener("abort", () => release(signal.reason), {
        once: true,
      });
    },
    promise,
  };
};

/**
 * Exposes an async atom as a promise for `await` in markup or `$derived(await ...)`. The promise is
 * stable while the result is unchanged, and a new one is issued when the result changes, so Svelte
 * re-runs dependents only on real updates. Failures reject with the squashed cause, or resolve with
 * the `Failure` when `includeFailure` is set. On the server, an atom with a `withServerValue`
 * override resolves from that value and is never computed; if the value is `Initial`, the promise
 * rejects, so read it inside a `<svelte:boundary>` with a `pending` snippet.
 *
 * **Example** (Awaiting an atom in the markup)
 *
 * ```ts
 * import { useAtomSuspense } from "effect-atom-svelte";
 * import { todosAtom } from "./atoms.ts";
 *
 * const todos = useAtomSuspense(todosAtom);
 * // In the markup, inside a <svelte:boundary>: {#each await todos.current as todo}
 * ```
 *
 * @stability unstable
 * @since 0.1.0
 * @category async
 */
export function useAtomSuspense<A, E>(
  input: AtomInput<Atom.Atom<AsyncResult.AsyncResult<A, E>>>,
  options?: SuspenseOptions & { readonly includeFailure?: false | undefined }
): AtomValue<Promise<A>>;
export function useAtomSuspense<A, E>(
  input: AtomInput<Atom.Atom<AsyncResult.AsyncResult<A, E>>>,
  options: SuspenseOptions & { readonly includeFailure: true }
): AtomValue<Promise<AsyncResult.Success<A, E> | AsyncResult.Failure<A, E>>>;
export function useAtomSuspense<A, E>(
  input: AtomInput<Atom.Atom<AsyncResult.AsyncResult<A, E>>>,
  options?: SuspenseOptions & { readonly includeFailure?: boolean | undefined }
): AtomValue<
  Promise<A | AsyncResult.Success<A, E> | AsyncResult.Failure<A, E>>
>;
export function useAtomSuspense<A, E>(
  input: AtomInput<Atom.Atom<AsyncResult.AsyncResult<A, E>>>,
  options: SuspenseOptions = {}
): AtomValue<Promise<unknown>> {
  const registry = getRegistry();
  const getAtom = toGetter(input);
  const result = useAtomValue(getAtom);
  const seed = seedFromServer(registry, getAtom, options.revalidateOnHydrate);
  // A plain variable, not $state: a render in a batch with this write rolled back would take the
  // pre-seed path and track nothing but the flag. Reading `trackSeed` asks for a re-read instead.
  let seeded = seed === undefined;
  if (seed) {
    void (async () => {
      await seed;
      seeded = true;
    })();
  }
  const trackSeed =
    seed && BROWSER
      ? createSubscriber((update) => {
          let live = true;
          void (async () => {
            await seed;
            if (live) {
              update();
            }
          })();
          return () => {
            live = false;
          };
        })
      : undefined;
  const afterSeed = new WeakMap<ResultAtom<A, E>, Promise<unknown>>();
  // Holds waits read outside any derived or effect (a top-level await in the script, an event
  // handler), which cannot say when they are done with them, until the component is destroyed.
  const lifetime = new AbortController();
  onTeardown(() => lifetime.abort());

  const waits = new WeakMap<AsyncResult.AsyncResult<A, E>, SharedWait>();
  const settle = (
    atom: ResultAtom<A, E>,
    current: AsyncResult.AsyncResult<A, E>,
    signal: AbortSignal
  ): Promise<unknown> => {
    let wait = waits.get(current);
    if (!wait) {
      wait = sharedWait(
        (abort) => suspend(registry, atom, current, options, abort),
        () => waits.delete(current)
      );
      waits.set(current, wait);
    }
    wait.hold(signal);
    return wait.promise;
  };

  const fromServer = new WeakMap<
    AsyncResult.AsyncResult<A, E>,
    Promise<unknown>
  >();

  return new AtomCell<Promise<unknown>, never>(() => {
    if (!BROWSER && hasServerValue(getAtom())) {
      const { current } = result;
      let promise = fromServer.get(current);
      if (!promise) {
        promise = fromServerValue(current, options);
        fromServer.set(current, promise);
      }
      return promise;
    }
    if (!seeded && seed) {
      // Reading the atom before the seed lands would fetch what hydration is about to provide.
      const atom = getAtom();
      trackSeed?.();
      let promise = afterSeed.get(atom);
      if (!promise) {
        promise = (async () => {
          await seed;
          // Destroyed meanwhile: nobody awaits this, and reading would compute the atom for nobody.
          if (lifetime.signal.aborted) {
            return undefined;
          }
          // Shared by every reader that came before the seed, so the component holds it.
          return settle(atom, registry.get(atom), lifetime.signal);
        })();
        afterSeed.set(atom, promise);
      }
      return promise;
    }
    return settle(getAtom(), result.current, readerSignal() ?? lifetime.signal);
  }, readOnly);
}
