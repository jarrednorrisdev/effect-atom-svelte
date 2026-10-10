/**
 * Hooks that read, write and await atoms from Svelte 5 components.
 *
 * @since 0.1.0
 */
import { Cause, Effect, Exit } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import type { AtomRef } from "effect/reactivity";
import { BROWSER, DEV } from "esm-env";
import { getAbortSignal, hydratable, untrack } from "svelte";
import { createSubscriber } from "svelte/reactivity";

import { onDispose } from "./internal/disposal.ts";
import {
  decodeSeed,
  encodeSeed,
  isWaiting,
  noSeed,
  revalidatesOnHydrate,
} from "./internal/hydration.ts";
import { onRenderEnd } from "./internal/renderEnd.ts";
import { reportReads } from "./internal/scope.svelte.ts";
import type { ReadKind } from "./internal/scope.svelte.ts";
import { onTeardown } from "./internal/teardown.svelte.ts";
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
 * A reactive read-only value. Read `.current` in markup, `$derived` or `$effect` to track it.
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
// useAtomSubscribe keeps its own order on top of this (see orderedDelivery).
let activeReads = 0;

const afterReads = (update: () => void): void => {
  if (activeReads > 0) {
    queueMicrotask(update);
  } else {
    update();
  }
};

const notifyAfterReads = (update: () => void) => () => afterReads(update);

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

/** The parts of the registry implementation's nodes the hooks use. */
interface RegistryNode {
  readonly canBeRemoved: boolean;
  /** Whether the node holds an initial value its first build will keep. */
  readonly preserveInitialValueOnBuild: boolean;
  readonly _value: unknown;
  readonly setValue: (value: unknown) => void;
  readonly setInitialValue: (value: unknown) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

/** The parts of the registry implementation the hooks use. */
interface RegistryInternals {
  readonly ensureNode: (atom: Atom.Atom<unknown>) => RegistryNode;
  readonly scheduleNodeRemoval: (node: RegistryNode) => void;
}

// SAFETY: ensureNode and scheduleNodeRemoval are on the registry implementation, not the interface
// (Effect 4.0.0); @effect/atom-react uses ensureNode the same way.
const internals = (registry: AtomRegistry.AtomRegistry): RegistryInternals =>
  registry as unknown as RegistryInternals;

/** The atom that holds a value given to `atom`: a wrapper such as `withRefresh` passes it on. */
const initialValueTarget = (atom: Atom.Atom<unknown>): Atom.Atom<unknown> => {
  let target = atom;
  while (target.initialValueTarget) {
    target = target.initialValueTarget;
  }
  return target;
};

/**
 * Keeps an atom's node in the registry without computing it, as a mount would but without the read.
 * The registry sweeps a node without listeners, so a listener holds it; letting go schedules the
 * sweep, as an unsubscribe does. Each hold has its own listener: the node keeps its listeners in a
 * set, so holds sharing one would all end with the first to let go.
 */
const holdNode = (
  registry: RegistryInternals,
  node: RegistryNode
): (() => void) => {
  const unsubscribe = node.subscribe(() => undefined);
  return () => {
    unsubscribe();
    if (node.canBeRemoved) {
      registry.scheduleNodeRemoval(node);
    }
  };
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

/**
 * A promise-mode setter's wait: as `awaitResult` with `suspendOnWaiting`, but a change to a result
 * from before the call, which is what `Atom.Reset` from another setter leaves (an idle `Initial`,
 * or an `Atom.fn`'s `initialValue`), ends it as interrupted. The reset interrupts the call, so
 * otherwise the wait would hang until the next call, or settle with the initial value.
 */
const awaitWrite = (
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>,
  start: number,
  signal: AbortSignal
): Promise<Exit.Exit<unknown, unknown>> =>
  Effect.runPromiseExit(
    Effect.callback<unknown, unknown>((resume) => {
      const first = registry.get(atom);
      if (first._tag !== "Initial" && !first.waiting) {
        resume(AsyncResult.toExit(first) as Exit.Exit<unknown, unknown>);
        return;
      }
      const cancel = registry.subscribe(atom, (result) => {
        if (result.waiting) {
          return;
        }
        cancel();
        const reset =
          result._tag === "Initial" ||
          (result._tag === "Success" && result.timestamp < start);
        resume(
          reset
            ? Exit.interrupt()
            : (AsyncResult.toExit(result) as Exit.Exit<unknown, unknown>)
        );
      });
      return Effect.sync(cancel);
    }),
    { signal }
  );

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
    // await, keeps it for the request. The mounts are released when the server render ends,
    // because a registry passed in by the caller outlives the request (JND-17).
    // An atom with a withServerValue override is never computed on the server, so it is not mounted:
    // mounting would run its real read, which is often browser-only. Nor is one that holds a value
    // from useAtomInitialValues: the server renders that value, which is what the atom's first build
    // would keep, without running a read that may be browser-only or start a request.
    // Once the render has ended, a read that switches atoms, as from a reader kept past the render,
    // takes no mount: nothing would release it.
    let ended = false;
    const releases: (() => void)[] = [];
    onRenderEnd(() => {
      ended = true;
      for (const release of releases) {
        release();
      }
    });
    const nodes = internals(registry);
    const mount = (atom: Atom.Atom<A>) => {
      if (ended || hasServerValue(atom)) {
        return atom;
      }
      const node = nodes.ensureNode(atom);
      releases.push(
        node.preserveInitialValueOnBuild
          ? holdNode(nodes, node)
          : registry.mount(atom)
      );
      return atom;
    };
    let mounted = mount(getAtom());
    return () => {
      const atom = getAtom();
      if (atom !== mounted) {
        mounted = mount(atom);
      }
      if (!hasServerValue(atom)) {
        const node = nodes.ensureNode(atom);
        if (node.preserveInitialValueOnBuild) {
          return node._value as A;
        }
      }
      return Atom.getServerValue(atom, registry);
    };
  }
  reportReads(registry, getAtom, "read");
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
  // Whether the component has mounted: its effects have run once.
  let mounted = false;
  // The atom this reader's own registry.get is reading. A subscribed node is rebuilt as soon as it
  // goes stale, so the read builds it only the first time, and that build announces the very value
  // the read returns. Before the component mounts, that announcement can only re-render its first
  // render, which already has the value, so it is dropped. Delivered on a microtask it started a
  // Svelte batch that, when the first render ran after an await in markup (a HydrationBoundary
  // awaiting its state), committed before hydration's own and made Svelte's dev build throw "Batch
  // has scheduled effects" (JND-95). After mount it is still delivered, as before. Nothing depends
  // on the update it starts: a getter switched in onMount once did, by accident, as that update
  // rendered before the registry swept the old atom (JND-98, fixed in the effect below).
  let reading: Atom.Atom<A> | undefined;
  const listen = (current: Atom.Atom<A>, update: () => void) =>
    registry.subscribe(current, () => {
      if (mounted || reading !== current) {
        update();
      }
    });
  const follow = (current: Atom.Atom<A>) => {
    if (kept?.atom === current) {
      const { cancel: keptCancel } = kept;
      kept = undefined;
      return keptCancel;
    }
    return notify ? listen(current, notify) : undefined;
  };
  $effect(() => {
    mounted = true;
    committed = getAtom();
    if (kept && kept.atom !== committed) {
      releaseKept();
    }
    // A render with the switch rolled back can read the old atom after the render that commits, so
    // the subscription may follow an atom the commit did not pick. It moves to the committed atom,
    // or that atom's later changes, a refresh's result or failure included, would not reach the
    // page (JND-93).
    // The atom it leaves is kept, not released: this effect can run before the switch it reads has
    // committed. A getter switched in onMount is read here in the same flush, while Svelte's batch
    // for the switch is still pending, and the renders with that batch rolled back read the old
    // atom. Released here, the registry could sweep it before they do, and they would compute it
    // again (JND-98). A later run that commits another atom releases it.
    if (atom !== undefined && atom !== committed) {
      const previous = atom;
      const previousCancel = cancel;
      // Subscribing can throw, as it rebuilds a stale atom; nothing moves until it has succeeded.
      const next = follow(committed);
      atom = committed;
      cancel = next;
      if (previousCancel) {
        releaseKept();
        kept = { atom: previous, cancel: previousCancel };
      }
    }
  });
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
        // As in the effect: a throwing subscribe leaves the reader on its old atom, to try again.
        const next = follow(current);
        atom = current;
        cancel = next;
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
      const outer = reading;
      reading = current;
      try {
        return registry.get(current);
      } finally {
        reading = outer;
      }
    });
};

/**
 * Reads an atom, optionally through a transform. The atom stays mounted while something reactive
 * reads `.current`, and unmounted when nothing does. The transform runs again only when the atom,
 * or state the transform reads, changes, so a transform that builds an object returns the same
 * object until then. A read outside a reactive context, such as in an event handler, runs it again.
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
  if (!f) {
    return new AtomCell<A, never>(read, readOnly);
  }
  // A derived keeps the transform's result, and its identity, until the atom or state the transform
  // reads changes. Outside a reactive context nothing subscribes, so the derived would not hear the
  // atom change: such a read runs the transform again (JND-25).
  const mapped = $derived(f(read()));
  return new AtomCell<B, never>(
    () => ($effect.tracking() ? mapped : f(read())),
    readOnly
  );
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

/** useAtomMount, telling an inspector scope why the atom is held: `useAtomSet` holds it to write. */
const mountWhileAlive = (
  input: AtomInput<Atom.Atom<unknown>>,
  kind: ReadKind
): void => {
  const registry = getRegistry();
  const getAtom = toGetter(input);
  reportReads(registry, getAtom, kind);
  $effect(() => registry.mount(getAtom()));
};

/**
 * Keeps an atom alive for as long as this component is mounted, even when no component reads
 * it. Use it in a component that outlives the readers, such as a layout, so the atom keeps its
 * value while they come and go. Mounting an atom that hasn't been computed also computes it.
 *
 * **Example** (Keeping a connection open while a component is mounted)
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
  mountWhileAlive(input, "mount");
};
/**
 * Returns a setter. The atom is mounted for the component's lifetime, so an `Atom.fn` keeps its
 * state between calls and is not disposed between set and read.
 *
 * In `value` mode a function passed to the setter is an updater, called with the current value. To
 * store a function in an atom, wrap it: `set(() => handler)`.
 *
 * In `promise` and `promiseExit` modes the setter waits for the atom's next settled result. The
 * wait holds the atom, so a call still in flight keeps it running after the component is
 * destroyed, until it settles, unless the `RegistryProvider` that created the registry is
 * destroyed: that interrupts the call and settles it as interrupted. The call's `signal` cancels only the wait: an `Atom.fn` already
 * running keeps going (send `Atom.Interrupt` to stop it). A signal that is already aborted settles
 * the call as interrupted without writing, as `fetch` does. Calls on one `Atom.fn` share its single
 * result, so a new call supersedes one in flight and every pending call resolves with the latest
 * call's result. `Atom.Reset` has no result to wait for, so these modes leave it out of their
 * types and reject it; reset with a `value` mode setter. A reset written while a promise-mode call
 * is pending settles that promise as interrupted. To cancel a call, send `Atom.Interrupt`.
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
): (value: Exclude<W, Atom.Reset>, options?: WriteOptions) => Promise<A>;
export function useAtomSet<A, E, W>(
  input: AtomInput<Atom.Writable<AsyncResult.AsyncResult<A, E>, W>>,
  options: { readonly mode: "promiseExit" }
): (
  value: Exclude<W, Atom.Reset>,
  options?: WriteOptions
) => Promise<Exit.Exit<A, E>>;
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
  mountWhileAlive(getAtom, "write");
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
    if (value === Atom.Reset) {
      // Excluded by the types: a reset result is Initial, which never settles, so the wait would
      // never end.
      throw new TypeError(
        `useAtomSet's ${mode} mode cannot wait for Atom.Reset; reset with a value mode setter`
      );
    }
    const atom = getAtom() as Atom.Writable<
      AsyncResult.AsyncResult<unknown, unknown>,
      unknown
    >;
    // An already aborted signal settles as interrupted without writing, as fetch does (JND-25). It
    // skips the wait too: Effect checks the signal only after a first run, which would return a
    // result the atom already holds from an earlier call.
    let exit: Exit.Exit<unknown, unknown>;
    if (writeOptions?.signal?.aborted) {
      exit = Exit.interrupt();
    } else {
      const start = Date.now();
      registry.set(atom, value);
      // A provider disposing of its registry ends the call without a last result, so the wait ends
      // there too, as interrupted.
      const controller = new AbortController();
      const abort = () => controller.abort();
      writeOptions?.signal?.addEventListener("abort", abort, { once: true });
      const cancel = onDispose(registry, abort);
      try {
        exit = await awaitWrite(registry, atom, start, controller.signal);
      } finally {
        cancel();
        writeOptions?.signal?.removeEventListener("abort", abort);
      }
    }
    return mode === "promiseExit" ? exit : valueOrThrow(exit);
  };
}

/**
 * Returns a function that runs the atom again. The atom is mounted so the refresh is not lost.
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
 * Delivers each value to `f` as afterReads would, but in order and only while subscribed. Once a
 * change raised during a read is deferred, later changes queue behind it, so `f` never hears an
 * older value after a newer one; whatever is still queued when the subscription ends is dropped.
 */
const orderedDelivery = <A>(
  f: (value: A) => void
): ((value: A) => void) & { readonly stop: () => void } => {
  let live = true;
  let flushing = false;
  const queue: A[] = [];
  // Stopping empties the queue, which ends a flush in progress.
  const flush = () => {
    try {
      while (queue.length > 0) {
        f(queue.shift() as A);
      }
    } finally {
      // Still queued only if `f` threw: the rest goes out on the next microtask.
      flushing = queue.length > 0;
      if (flushing) {
        queueMicrotask(flush);
      }
    }
  };
  const deliver = (value: A) => {
    if (!live) {
      return;
    }
    if (flushing || activeReads > 0) {
      queue.push(value);
      if (!flushing) {
        flushing = true;
        queueMicrotask(flush);
      }
    } else {
      f(value);
    }
  };
  return Object.assign(deliver, {
    stop: () => {
      live = false;
      queue.length = 0;
    },
  });
};

/**
 * Calls `f` on every change while the component lives, and with the current value first when
 * `immediate` is set. The atom is computed once the component mounts, and never on the server, so a
 * derived or effect atom that nothing else reads still runs and reports its changes. A change raised while another component
 * is reading an atom reaches `f` on a microtask, so `f` can write `$state` (Svelte forbids that
 * during a read). Changes after it wait their turn, so `f` sees every change in order; any other
 * change reaches it synchronously. Nothing reaches `f` once the component is destroyed, not even a
 * change still waiting for its microtask.
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
  reportReads(registry, getAtom, "subscribe");
  // The effect follows the atom, not what the getter reads: a getter that runs again and returns
  // the same atom must not call `immediate` again, nor drop a change still waiting for delivery.
  const current = $derived(getAtom());
  $effect(() => {
    const atom = current;
    // `immediate` calls `f` now, inside this effect; what `f` reads must not re-run it.
    return untrack(() => {
      // registry.subscribe does not compute a node that has never been read, so an atom nothing
      // else reads would never run, and a derived atom would never hear its sources. Reading it
      // first builds it.
      const value = duringRead(() => registry.get(atom));
      if (options?.immediate === true) {
        f(value);
      }
      const deliver = orderedDelivery(f);
      const cancel = registry.subscribe(atom, deliver);
      return () => {
        deliver.stop();
        cancel();
      };
    });
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
  internals(registry).ensureNode(atom).setValue(value);
};

// The nodes given a value by useAtomInitialValues. A node belongs to one registry, and a node the
// registry sweeps is gone from here too, so the next component to start it gives it the value again.
const initialValuesApplied = new WeakSet<RegistryNode>();

// On the server, how many renders hold each applied node. The value applies again only once none
// does, so a request ending doesn't let a request starting overwrite the value another still renders.
const serverHolders = new WeakMap<RegistryNode, number>();

/**
 * Sets starting values as `AtomRegistry.make({ initialValues })` would: on the atom that receives it
 * (a wrapper such as `withRefresh` passes it to its source), kept as the value of the atom's first
 * build, which still reads and follows the atom's sources. The atoms are not computed here: each
 * keeps its value, uncomputed, while this component lives, and the first component to read it
 * computes it from there, so a value set in a layout is still there when a page reads it later, and
 * an atom that can only compute in the browser can start from a value on the server.
 *
 * A value applies once while the atom is held, so a component mounted later, or a second
 * component with its own value, does not overwrite a value the atom has moved on from since the
 * first applied one. An atom that is already in use without one, read by another component, is set
 * to the value, as `@effect/atom-react` does. Once nothing holds the atom and the registry disposes
 * it, the next component to start it applies its value again. On the server a value lasts one render, so each request against a shared registry applies
 * its own; requests rendering at the same time share the registry's atoms, and with them the value
 * the first one applied.
 *
 * **Example** (Starting an atom from a prop)
 *
 * ```ts
 * import { untrack } from "svelte";
 * import { useAtomInitialValues, useAtomValue } from "effect-atom-svelte";
 * import { countAtom } from "./atoms.ts";
 *
 * const { start } = $props();
 * // Only the first value counts, so untrack says a later change to the prop is not followed.
 * useAtomInitialValues([[countAtom, untrack(() => start)]]);
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
  const registry = internals(getRegistry());
  const releases: (() => void)[] = [];
  // Registered before the loop: an entry that throws midway leaves the earlier ones held otherwise.
  onTeardown(() => {
    for (const release of releases) {
      release();
    }
  });
  for (const [atom, value] of initialValues) {
    const node = registry.ensureNode(initialValueTarget(atom));
    if (!initialValuesApplied.has(node)) {
      initialValuesApplied.add(node);
      node.setInitialValue(value);
    }
    if (!BROWSER) {
      // A registry passed in by the caller outlives the request, and its node may not be swept
      // before the next request starts, whose value must apply too (JND-17). Requests rendering at
      // the same time share the value the first applied, until the last of them ends.
      serverHolders.set(node, (serverHolders.get(node) ?? 0) + 1);
      releases.push(() => {
        const holders = (serverHolders.get(node) ?? 1) - 1;
        serverHolders.set(node, holders);
        if (holders === 0) {
          initialValuesApplied.delete(node);
        }
      });
    }
    releases.push(holdNode(registry, node));
  }
};

/**
 * Reads an `AtomRef`, following it when the getter returns a different ref. For one property of a
 * ref, use `useAtomRefPropValue`.
 *
 * A ref has no registry. On the server, one created at module level is shared by every request,
 * so don't write a visitor's data to it there: see
 * https://atom.jarrednorris.dev/server-rendering#module-state-is-shared-between-visitors
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
 * Returns `ref.prop(prop)`, the `AtomRef` for one property of an `AtomRef`. It takes the ref
 * itself, not a getter, and does not follow later changes to `ref` or `prop`; to read a property
 * of a ref picked by a getter, use `useAtomRefPropValue`.
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
 * Reads one property of an `AtomRef`, following the getter to a different ref. `prop` is taken
 * once, when the component starts, and is not followed.
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

// Internal shorthand; exported signatures spell the type out so the API reference shows it.
type ResultAtom<A, E> = Atom.Atom<AsyncResult.AsyncResult<A, E>>;

/**
 * Whether a result is `Initial` with nothing running to settle it, as an `Atom.fn` nothing has
 * called. On the server nothing will start it during the render, so waiting would hang it.
 */
const notStarted = (
  result: AsyncResult.AsyncResult<unknown, unknown>
): boolean => result._tag === "Initial" && !result.waiting;

const notStartedError = (hook: string): Error =>
  new Error(
    `${hook} read an atom that has not started on the server: its result is Initial and nothing is running it, as for an Atom.fn that has not been called, so the render would wait for it forever. Read it with useAtomValue, which renders Initial, or inside a <svelte:boundary> with a pending snippet, which the server renders instead.`
  );

/**
 * Whether, on the server, an atom's node holds a value from `useAtomInitialValues`. The server
 * renders that value, as `subscribedReader` does: mounting, reading or waiting for the atom would
 * run its read, which may be browser-only or start a request the value was there to save.
 */
const initialOnServer = (
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<unknown>
): boolean =>
  !BROWSER && internals(registry).ensureNode(atom).preserveInitialValueOnBuild;
/** Keeps an atom for the server render: a node with an initial value is held, not mounted. */
const serverMount = (
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<unknown>
): (() => void) =>
  initialOnServer(registry, atom)
    ? holdNode(internals(registry), internals(registry).ensureNode(atom))
    : registry.mount(atom);
/** Reads an atom on the server, without building a node that has an initial value. */
const serverGet = <A>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<A>
): A =>
  initialOnServer(registry, atom)
    ? (internals(registry).ensureNode(atom)._value as A)
    : registry.get(atom);

/** One serialization key's seed in a registry, shared by every component using that key. */
interface Seed {
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
  const target = initialValueTarget(atom);
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
// The keys, by their render's promise, that some reader reads with suspendOnWaiting: the seed is
// then the settled result that reader renders, whichever reader claimed the key first.
const settledSeeds = new WeakSet<Promise<unknown>>();

/**
 * On the server each request seeds for itself: `hydratable` already shares one result per key
 * within a render, and a per-registry record would outlive the request when the caller owns the
 * registry, so later requests would skip embedding their seed (JND-17).
 */
const seedOnServer = (
  registry: AtomRegistry.AtomRegistry,
  atom: ResultAtom<unknown, unknown>,
  key: string,
  encode: (value: AsyncResult.AsyncResult<unknown, unknown>) => unknown,
  suspendOnWaiting?: boolean | undefined
): Promise<void> => {
  // Mounted until the render ends, so the settled node is what the render reads.
  const release = serverMount(registry, atom);
  // A render ends before its seeds settle only when it fails, as when a later reader throws during
  // setup. The provider has disposed of the registry by then, so the seed reads nothing from it.
  let ended = false;
  onRenderEnd(() => {
    ended = true;
    release();
  });
  // hydratable hands every later reader of a key the first reader's value, but Svelte's dev build
  // also runs each later reader's callback and throws hydratable_clobbering if what it encodes
  // differs. Reading the atom again there would encode whatever it holds by then, so a later
  // reader's callback encodes the first reader's seed instead: the callback runs inside hydratable,
  // and once it has returned, `claim.first` says whose call it was.
  const claim: { first?: Promise<unknown>; own?: Promise<unknown> } = {};
  const encoded = hydratable(key, () => {
    claim.own = (async () => {
      await undefined;
      if (ended) {
        return noSeed;
      }
      if (claim.first !== claim.own) {
        return await claim.first;
      }
      // Not waited for if nothing has started it: the hook rejects once seeded. Waited for as the hook
      // waits, so with suspendOnWaiting the seed is the settled result the render shows, not one the
      // browser would run again because it was still waiting.
      if (!initialOnServer(registry, atom) && !notStarted(registry.get(atom))) {
        let settled = suspendOnWaiting === true;
        await awaitResult(registry, atom, { suspendOnWaiting: settled });
        // A later reader of the key may want the settled result once this one's wait has begun.
        if (!settled && claim.first && settledSeeds.has(claim.first)) {
          settled = true;
          await awaitResult(registry, atom, { suspendOnWaiting: settled });
        }
      }
      if (ended) {
        return noSeed;
      }
      return encodeSeed(key, encode, serverGet(registry, atom));
    })();
    return claim.own;
  });
  claim.first = encoded;
  if (suspendOnWaiting === true) {
    settledSeeds.add(encoded);
  }
  const claimed = serverSeeds.get(encoded);
  if (claimed && claimed !== atom) {
    throw new Error(`Two different atoms share the serialization key "${key}"`);
  }
  serverSeeds.set(encoded, atom);
  return (async () => {
    await encoded;
  })();
};

/** A hook's wait for its seed. */
interface SeedWait {
  /** Resolves once the seed is in, or there is none to wait for. */
  readonly done: Promise<void>;
  /**
   * Lets go of the mount that holds the seeded atom for the hook, once the hook holds what it
   * reads itself. Until then the mount lasts until the component is destroyed or commits a switch
   * to another atom, which while a first load is pending is never (JND-59).
   */
  readonly letGo: () => void;
}

const noSeedMount = (): void => undefined;

/**
 * The keys of the server's values on this page that a reader has had its chance at, per page: for
 * each, `hydratable` either returned the server's value or the development warning below was shown.
 * Svelte keeps the values on `window.__svelte.h` and never removes them, so a key a reader has had
 * is not missed when a later render, after client-side navigation, reads it again.
 */
const claimedKeys = new WeakMap<object, Set<string>>();

// The store is not public API, so a Svelte that changes its shape or drops it turns the warning off
// rather than throwing.
const serverValues = (): ReadonlyMap<string, unknown> | undefined => {
  const store = (globalThis as { __svelte?: { h?: unknown } }).__svelte?.h;
  return store instanceof Map ? store : undefined;
};

const warnIfSent = async (key: string, sent: unknown): Promise<void> => {
  try {
    // Undefined when the key wasn't sent, null when the server sent that it had no seed for it, as
    // for a defect: either way the browser was always going to compute the atom.
    const value = await sent;
    if (value === undefined || value === null) {
      return;
    }
  } catch {
    return;
  }
  console.warn(
    `effect-atom-svelte: the atom with serialization key "${key}" got no value from the server, so it runs again in the browser. Svelte stops hydrating at a component script's first top-level \`await\`, so call useAtomResult and useAtomSuspense before it, for example in one Promise.all. See https://atom.jarrednorris.dev/hydration#call-hooks-before-the-first-await`
  );
};

/**
 * Records that a reader had its chance at the server's value for `key`. Development builds warn
 * when it missed one the server sent for it: Svelte reads them only while it is hydrating, which
 * stops at a component script's first top-level `await`, so a hook called after one gets nothing
 * and its atom runs again in the browser (JND-96, fix proposed in sveltejs/svelte#18927). This reads
 * Svelte's internal store only to warn.
 */
const claimServerValue = (key: string, missed: boolean): void => {
  const store = DEV ? serverValues() : undefined;
  if (store === undefined) {
    return;
  }
  let claimed = claimedKeys.get(store);
  if (!claimed) {
    claimed = new Set();
    claimedKeys.set(store, claimed);
  }
  if (claimed.has(key)) {
    return;
  }
  claimed.add(key);
  if (!missed || !store.has(key)) {
    return;
  }
  // A result the server couldn't pass on, such as a defect, is sent as nothing: missing it changes
  // nothing. The value may still be on its way, as a promise.
  void warnIfSent(key, store.get(key));
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
  revalidateOption: boolean | undefined,
  suspendOnWaiting?: boolean | undefined
): SeedWait | undefined => {
  const atom = getAtom();
  // The server never computes an atom with a server value, so it has no value to pass on, and the
  // browser must not ask for one: hydratable throws for a key the server didn't write (JND-58).
  if (!Atom.isSerializable(atom) || hasServerValue(atom)) {
    return undefined;
  }
  const { decode, encode, key } = atom[Atom.SerializableTypeId];
  if (!BROWSER) {
    return {
      done: seedOnServer(registry, atom, key, encode, suspendOnWaiting),
      letGo: noSeedMount,
    };
  }
  const revalidate = revalidatesOnHydrate(revalidateOption);
  let registrySeeds = seeds.get(registry);
  if (!registrySeeds) {
    registrySeeds = { held: new Map(), spent: new Set() };
    seeds.set(registry, registrySeeds);
  }
  const { held, spent } = registrySeeds;
  // The server's value belongs to the key, not to an atom: the registry keeps a serializable atom's
  // value under its key, so every atom with the key reads it, as HydrationBoundary assumes too.
  // A remounted branch, as under {#key}, makes a new atom with the old one's key while the old one
  // still holds it, until Svelte destroys the old branch or its outro ends: the new atom joins it.
  let entry = held.get(key);
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
    claimServerValue(key, computedHere);
    let holders = 0;
    let revalidating = 0;
    entry = {
      done: (async () => {
        const value = await encoded;
        // Only the server's value is a seed, and only while someone is there to read it now: a seed
        // set later would show data however old by then (JND-37).
        // The server sends no seed for a result it can't or mustn't pass on, such as a defect: the
        // atom computes here instead. A seed still waiting, as a stream's between its values, runs
        // again too: the server's run ended with the render, so it would wait forever.
        const seed =
          !computedHere && holders > 0
            ? decodeSeed(key, value, decode)
            : undefined;
        if (seed !== undefined) {
          applySeed(registry, atom, seed, revalidating > 0 || isWaiting(seed));
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
  let handedOver = false;
  const letGo = () => {
    handedOver = true;
    release?.();
    release = undefined;
  };
  let left = false;
  const leave = () => {
    if (!left) {
      left = true;
      unhold();
      letGo();
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
  return {
    done: (async () => {
      await done;
      if (!left && !handedOver) {
        release = registry.mount(atom);
      }
    })(),
    letGo,
  };
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
   * Run a server-rendered atom again once the page has hydrated. Overrides `RegistryProvider`'s
   * `revalidateOnHydrate`, which defaults to `false`.
   */
  readonly revalidateOnHydrate?: boolean | undefined;
}

/**
 * Awaits an async atom's first result, then returns a live handle to its `AsyncResult`. Use it as
 * a top-level `await` in a component script; server rendering waits for it, and with a
 * serialization key the browser starts from the server's result instead of running the atom
 * again. With a getter, only the first atom is awaited: when the getter picks another atom the
 * handle follows it, starting from that atom's current result (often `Initial`), and the
 * component's await does not run again. On the server, an atom with a `withServerValue` override
 * reads as that value and is never computed. An atom that has not started, whose result is
 * `Initial` with nothing running, as an `Atom.fn` nothing has called, keeps the await pending in the
 * browser until something writes it; on the server, where nothing will during the render, the
 * await rejects.
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
  // Later atoms are mounted by this effect, which runs once the component mounts, so usually after
  // the await below. The first atom's mount is released then, as the effect holds it from there.
  let effectHolds = false;
  $effect(() => {
    effectHolds = true;
    const unmount = registry.mount(getAtom());
    release?.();
    release = undefined;
    return unmount;
  });
  const seed = seedFromServer(
    registry,
    getAtom,
    options?.revalidateOnHydrate,
    options?.suspendOnWaiting
  );
  if (seed) {
    await seed.done;
  }
  // Destroyed while seeding: reading the atom now would only compute it for nobody. On the server,
  // an atom with a server value is read as that value, with nothing to wait for.
  if (lifetime.signal.aborted || (!BROWSER && hasServerValue(atom))) {
    return value;
  }
  // On the server, an initial value is what the render shows, with nothing to wait for.
  if (initialOnServer(registry, atom)) {
    release = serverMount(registry, atom);
    return value;
  }
  if (effectHolds) {
    // Mounted while seeding, as when the promise is not awaited straight away: the effect holds the
    // getter's atom, and a mount here would never be released. Once the getter has switched away,
    // waiting would only compute the first atom for nobody.
    seed?.letGo();
    if (untrack(getAtom) !== atom) {
      return value;
    }
  } else {
    // Mounted only after seeding, so hydration's value is in place before the atom first computes.
    release = registry.mount(atom);
    seed?.letGo();
  }
  if (!BROWSER && notStarted(registry.get(atom))) {
    throw notStartedError("useAtomResult");
  }
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
   * Run a server-rendered atom again once the page has hydrated. Overrides `RegistryProvider`'s
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
    if (!BROWSER && notStarted(current)) {
      throw notStartedError("useAtomSuspense");
    }
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

/**
 * Mounts an atom until every signal has aborted. The release waits a microtask, as a reaction aborts
 * its signal before it re-runs, and the re-run's own subscription takes over.
 */
const holdWhileRead = (
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<unknown>,
  signals: readonly AbortSignal[]
): void => {
  const release = registry.mount(atom);
  let holders = signals.length;
  const letGo = () => {
    holders -= 1;
    if (holders === 0) {
      queueMicrotask(release);
    }
  };
  for (const signal of signals) {
    signal.addEventListener("abort", letGo, { once: true });
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
  // Each holder's abort listener, removed once the wait settles: the signal may outlive it by far, as
  // the component's lifetime signal does, and would otherwise keep one listener per result it read.
  const listeners: (readonly [AbortSignal, () => void])[] = [];
  void (async () => {
    try {
      await promise;
    } catch {
      // Rejections belong to the awaiting template; this stops an unread one being reported as unhandled.
    }
    settled = true;
    for (const [signal, listener] of listeners) {
      signal.removeEventListener("abort", listener);
    }
    listeners.length = 0;
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
      // A settled wait is never interrupted, so it needs no holders.
      if (settled || signal.aborted || held.has(signal)) {
        return;
      }
      held.add(signal);
      holders += 1;
      const listener = () => release(signal.reason);
      signal.addEventListener("abort", listener, { once: true });
      listeners.push([signal, listener]);
    },
    promise,
  };
};

/**
 * Exposes an async atom as a promise for `await` in markup or `$derived(await ...)`. The promise is
 * stable while the result is unchanged, and a new one is issued when the result changes, so Svelte
 * re-runs dependents only on real updates. Unchanged means the same atom and the same result
 * object: a refresh issues a new promise even if its value is equal, and so does a read after
 * every reader of a pending promise went away, as that wait was interrupted. Failures reject with the squashed cause, or resolve with
 * the `Failure` when `includeFailure` is set. On the server, an atom with a `withServerValue`
 * override resolves from that value and is never computed; if the value is `Initial`, the promise
 * rejects, so read it inside a `<svelte:boundary>` with a `pending` snippet. An atom that has not
 * started, whose result is `Initial` with nothing running, as an `Atom.fn` nothing has called,
 * stays pending in the browser until something writes it, and rejects on the server.
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
  const seed = seedFromServer(
    registry,
    getAtom,
    options.revalidateOnHydrate,
    options.suspendOnWaiting
  );
  // A plain variable, not $state: a render in a batch with this write rolled back would take the
  // pre-seed path and track nothing but the flag. Reading `trackSeed` asks for a re-read instead.
  let seeded = seed === undefined;
  if (seed) {
    void (async () => {
      await seed.done;
      seeded = true;
    })();
  }
  const trackSeed =
    seed && BROWSER
      ? createSubscriber((update) => {
          let live = true;
          void (async () => {
            await seed.done;
            if (live) {
              update();
            }
          })();
          return () => {
            live = false;
          };
        })
      : undefined;
  // Per atom, the promise every reader before the seed shares, and those readers' signals.
  const afterSeed = new WeakMap<
    ResultAtom<A, E>,
    { readonly promise: Promise<unknown>; readonly readers: Set<AbortSignal> }
  >();
  // Holds waits read outside any derived or effect (a top-level await in the script, an event
  // handler), which cannot say when they are done with them, until the component is destroyed.
  const lifetime = new AbortController();
  onTeardown(() => lifetime.abort());

  // Keyed by atom, then result: atoms can share a result object, as a derived atom returning its
  // source's result does, and a wait holds and waits for one atom.
  const waits = new WeakMap<
    ResultAtom<A, E>,
    WeakMap<AsyncResult.AsyncResult<A, E>, SharedWait>
  >();
  const settle = (
    atom: ResultAtom<A, E>,
    current: AsyncResult.AsyncResult<A, E>,
    signal: AbortSignal
  ): Promise<unknown> => {
    let atomWaits = waits.get(atom);
    if (!atomWaits) {
      atomWaits = new WeakMap();
      waits.set(atom, atomWaits);
    }
    let wait = atomWaits.get(current);
    if (!wait) {
      const forAtom = atomWaits;
      wait = sharedWait(
        (abort) => suspend(registry, atom, current, options, abort),
        () => forAtom.delete(current)
      );
      atomWaits.set(current, wait);
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
    const signal = readerSignal();
    if (!seeded && seed) {
      // Reading the atom before the seed lands would fetch what hydration is about to provide.
      const atom = getAtom();
      trackSeed?.();
      let pending = afterSeed.get(atom);
      if (!pending) {
        const readers = new Set<AbortSignal>();
        const promise = (async () => {
          await seed.done;
          // Held by the readers still there, not the component, so a getter switch while the first
          // load is pending interrupts it. None left, as when destroyed: nobody awaits this, and
          // reading would compute the atom for nobody.
          const live = [...readers].filter((reader) => !reader.aborted);
          if (live.length === 0) {
            return undefined;
          }
          // A read outside any reaction can't say when it is done, so it doesn't hold the atom: held
          // by the component's lifetime, the atom would stay mounted after the getter moves on.
          const reactions = live.filter((reader) => reader !== lifetime.signal);
          if (reactions.length > 0) {
            holdWhileRead(registry, atom, reactions);
          }
          seed.letGo();
          const current = registry.get(atom);
          let waited: Promise<unknown> | undefined;
          for (const reader of live) {
            waited = settle(atom, current, reader);
          }
          return waited;
        })();
        pending = { promise, readers };
        afterSeed.set(atom, pending);
      }
      pending.readers.add(signal ?? lifetime.signal);
      return pending.promise;
    }
    const promise = settle(
      getAtom(),
      result.current,
      signal ?? lifetime.signal
    );
    if (signal) {
      // A reaction read it, so the reader's subscription holds the atom from here.
      seed?.letGo();
    }
    return promise;
  }, readOnly);
}
