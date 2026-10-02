import { Cause, Effect, Exit } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import type { AtomRef } from "effect/reactivity";
import { BROWSER } from "esm-env";
import { hydratable, onDestroy } from "svelte";
import { createSubscriber } from "svelte/reactivity";

import { getRegistry } from "./RegistryContext.ts";

/** An atom, or a getter so the hook follows the atom when reactive state picks a different one. */
export type AtomInput<A> = A | (() => A);

export interface AtomValue<A> {
  readonly current: A;
}

export interface AtomState<R, W = R> {
  get current(): R;
  set current(value: W);
}

export type WriteMode = "value" | "promise" | "promiseExit";

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

const awaitResult = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  options?: { readonly suspendOnWaiting?: boolean | undefined },
  signal?: AbortSignal | undefined
): Promise<Exit.Exit<A, E>> =>
  Effect.runPromiseExit(AtomRegistry.getResult(registry, atom, options), {
    signal,
  });

const subscribedReader = <A>(
  registry: AtomRegistry.AtomRegistry,
  getAtom: () => Atom.Atom<A>
): (() => A) => {
  if (!BROWSER) {
    // Nothing subscribes during SSR, so without a mount the registry would sweep the node while the
    // render awaits, losing initial values and refetching async atoms. Mounting at setup, before any
    // await, keeps it for the request; the provider disposes its registry when rendering ends.
    // An atom with a withServerValue override is never computed on the server, so it is not mounted:
    // mounting would run its real read, which is often browser-only.
    const mount = (atom: Atom.Atom<A>) => {
      if (!(Atom.ServerValueTypeId in atom)) {
        registry.mount(atom);
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
  const atom = $derived(getAtom());
  const subscribe = $derived.by(() => {
    const current = atom;
    return createSubscriber((update) =>
      registry.subscribe(current, notifyAfterReads(update))
    );
  });
  return () =>
    duringRead(() => {
      subscribe();
      return registry.get(atom);
    });
};

/** Reads an atom. It stays mounted while something reactive reads `.current`. */
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

/** Reads and writes through `.current`, so `bind:value={state.current}` works. */
export const useAtom = <R, W>(
  input: AtomInput<Atom.Writable<R, W>>
): AtomState<R, W> => {
  const registry = getRegistry();
  const getAtom = toGetter(input);
  return new AtomCell<R, W>(subscribedReader(registry, getAtom), (value) =>
    registry.set(getAtom(), value)
  );
};

/** Keeps an atom mounted while the component lives, without reading it. */
export const useAtomMount = (input: AtomInput<Atom.Atom<unknown>>): void => {
  const registry = getRegistry();
  const getAtom = toGetter(input);
  $effect(() => registry.mount(getAtom()));
};

export function useAtomSet<R, W>(
  input: AtomInput<Atom.Writable<R, W>>,
  options?: { readonly mode?: "value" }
): (value: W | ((current: R) => W)) => void;
export function useAtomSet<A, E, W>(
  input: AtomInput<Atom.Writable<AsyncResult.AsyncResult<A, E>, W>>,
  options: { readonly mode: "promise" }
): (value: W, options?: WriteOptions) => Promise<A>;
export function useAtomSet<A, E, W>(
  input: AtomInput<Atom.Writable<AsyncResult.AsyncResult<A, E>, W>>,
  options: { readonly mode: "promiseExit" }
): (value: W, options?: WriteOptions) => Promise<Exit.Exit<A, E>>;
/**
 * Returns a setter. The atom is mounted for the component's lifetime, so an `Atom.fn` keeps its
 * state between calls and is not disposed between set and read.
 */
export function useAtomSet(
  input: AtomInput<Atom.Writable<unknown, unknown>>,
  options?: { readonly mode?: WriteMode }
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

/** Returns a function that recomputes the atom. The atom is mounted so the refresh is not lost. */
export const useAtomRefresh = (
  input: AtomInput<Atom.Atom<unknown>>
): (() => void) => {
  const registry = getRegistry();
  const getAtom = toGetter(input);
  useAtomMount(getAtom);
  return () => registry.refresh(getAtom());
};

/** Calls `f` on every change while the component lives. */
export const useAtomSubscribe = <A>(
  input: AtomInput<Atom.Atom<A>>,
  f: (value: A) => void,
  options?: { readonly immediate?: boolean }
): void => {
  const registry = getRegistry();
  const getAtom = toGetter(input);
  $effect(() => registry.subscribe(getAtom(), f, options));
};

const initialValuesApplied = new WeakMap<
  AtomRegistry.AtomRegistry,
  WeakSet<Atom.Atom<unknown>>
>();

/** Sets starting values once per registry, before anything reads the atoms. */
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
      // SAFETY: ensureNode is on the registry implementation, not the interface; @effect/atom-react uses it the same way.
      (
        registry as unknown as {
          ensureNode: (atom: Atom.Atom<unknown>) => {
            setValue: (value: unknown) => void;
          };
        }
      )
        .ensureNode(atom)
        .setValue(value);
    }
  }
};

/** Reads an `AtomRef`, following it when the getter returns a different ref. */
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

export const useAtomRefProp = <A, K extends keyof A>(
  ref: AtomRef.AtomRef<A>,
  prop: K
): AtomRef.AtomRef<A[K]> => ref.prop(prop);

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
// Svelte does not restore component context after an `await` in a component script, so every
// hook below does its setup synchronously and must be called before the component's first await.
// To wait on several, start them together: `await Promise.all([useAtomResult(a), useAtomResult(b)])`.
// ---------------------------------------------------------------------------------------------

type ResultAtom<A, E> = Atom.Atom<AsyncResult.AsyncResult<A, E>>;

const seeds = new WeakMap<
  AtomRegistry.AtomRegistry,
  Map<
    string,
    { readonly atom: Atom.Atom<unknown>; readonly done: Promise<void> }
  >
>();

/**
 * For a serializable atom, resolves it and passes the encoded result from server to client with
 * `hydratable`, so hydration seeds the registry instead of fetching again. Must run synchronously
 * during component init. Returns undefined for atoms without a serialization key.
 */
const seedFromServer = (
  registry: AtomRegistry.AtomRegistry,
  atom: ResultAtom<unknown, unknown>
): Promise<void> | undefined => {
  if (!Atom.isSerializable(atom)) {
    return undefined;
  }
  const { encode, key } = atom[Atom.SerializableTypeId];
  let byKey = seeds.get(registry);
  if (!byKey) {
    byKey = new Map();
    seeds.set(registry, byKey);
  }
  const existing = byKey.get(key);
  if (existing) {
    if (existing.atom !== atom) {
      throw new Error(
        `Two different atoms share the serialization key "${key}"`
      );
    }
    return existing.done;
  }
  // Held until the component is destroyed, so the settled node is what the render reads.
  onDestroy(registry.mount(atom));
  const encoded = hydratable(key, async () => {
    await awaitResult(registry, atom);
    return encode(registry.get(atom));
  });
  const done = (async () => {
    const value = await encoded;
    if (BROWSER) {
      registry.setSerializable(key, value);
    }
  })();
  byKey.set(key, { atom, done });
  return done;
};

/**
 * Awaits an async atom's first result, then returns a live handle to its `AsyncResult`. Use it as
 * a top-level `await` in a component script; SSR waits for it, and with a serialization key the
 * result is reused during hydration instead of fetched again.
 *
 * ```svelte
 * <script>
 *   const todos = await useAtomResult(todosAtom);
 * </script>
 * ```
 */
export const useAtomResult = async <A, E>(
  atom: ResultAtom<A, E>,
  options?: { readonly suspendOnWaiting?: boolean | undefined }
): Promise<AtomValue<AsyncResult.AsyncResult<A, E>>> => {
  const registry = getRegistry();
  const value = useAtomValue(atom);
  const releases: (() => void)[] = [];
  onDestroy(() => {
    for (const release of releases) {
      release();
    }
  });
  const seed = seedFromServer(registry, atom);
  if (seed) {
    await seed;
  }
  // Mounted only after seeding, so hydration's value is in place before the atom first computes.
  releases.push(registry.mount(atom));
  await awaitResult(registry, atom, options);
  return value;
};

export interface SuspenseOptions {
  /** Treat a refreshing result as pending, so `await` shows the boundary's pending state again. */
  readonly suspendOnWaiting?: boolean | undefined;
  /** Resolve with the Success or Failure result instead of the value, rather than rejecting. */
  readonly includeFailure?: boolean | undefined;
}

const suspend = async <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: ResultAtom<A, E>,
  current: AsyncResult.AsyncResult<A, E>,
  options: SuspenseOptions
): Promise<unknown> => {
  const pending =
    current._tag === "Initial" ||
    (options.suspendOnWaiting === true && current.waiting);
  if (pending) {
    const exit = await awaitResult(registry, atom, {
      suspendOnWaiting: options.suspendOnWaiting,
    });
    if (options.includeFailure) {
      return Exit.isSuccess(exit)
        ? AsyncResult.success(exit.value)
        : AsyncResult.failure(exit.cause);
    }
    return valueOrThrow(exit);
  }
  if (current._tag === "Success") {
    return options.includeFailure ? current : current.value;
  }
  if (options.includeFailure) {
    return current;
  }
  throw Cause.squash(current.cause);
};

export function useAtomSuspense<A, E>(
  input: AtomInput<ResultAtom<A, E>>,
  options?: SuspenseOptions & { readonly includeFailure?: false | undefined }
): AtomValue<Promise<A>>;
export function useAtomSuspense<A, E>(
  input: AtomInput<ResultAtom<A, E>>,
  options: SuspenseOptions & { readonly includeFailure: true }
): AtomValue<Promise<AsyncResult.Success<A, E> | AsyncResult.Failure<A, E>>>;
/**
 * Exposes an async atom as a promise for `await` in markup or `$derived(await ...)`. The promise is
 * stable while the result is unchanged, and a new one is issued when the result changes, so Svelte
 * re-runs dependents only on real updates. Failures reject with the squashed cause.
 */
export function useAtomSuspense<A, E>(
  input: AtomInput<ResultAtom<A, E>>,
  options: SuspenseOptions = {}
): AtomValue<Promise<unknown>> {
  const registry = getRegistry();
  const getAtom = toGetter(input);
  const result = useAtomValue(getAtom);
  const seed = seedFromServer(registry, getAtom());
  let seeded = $state(seed === undefined);
  let afterSeed: Promise<unknown> | undefined;
  if (seed) {
    void (async () => {
      await seed;
      seeded = true;
    })();
  }

  const promises = new WeakMap<
    AsyncResult.AsyncResult<A, E>,
    Promise<unknown>
  >();
  const settle = (
    atom: ResultAtom<A, E>,
    current: AsyncResult.AsyncResult<A, E>
  ): Promise<unknown> => {
    const cached = promises.get(current);
    if (cached) {
      return cached;
    }
    const promise = suspend(registry, atom, current, options);
    // Rejections belong to the awaiting template; this stops an unread one being reported as unhandled.
    // oxlint-disable-next-line promise/prefer-await-to-then
    promise.catch(() => null);
    promises.set(current, promise);
    return promise;
  };

  return new AtomCell<Promise<unknown>, never>(() => {
    if (!seeded && seed) {
      // Reading the atom before the seed lands would fetch what hydration is about to provide.
      afterSeed ??= (async () => {
        await seed;
        return settle(getAtom(), registry.get(getAtom()));
      })();
      return afterSeed;
    }
    return settle(getAtom(), result.current);
  }, readOnly);
}
