// Its own file: these tests dispose of a provider's registry while a finalizer throws. That error
// used to escape the provider's teardown and abort the Svelte flush that unmounted it, which left
// Svelte's scheduler broken for the rest of the page: later tests in the same file saw each
// $derived run again on every read.
import { Cause, Effect, Exit } from "effect";
import { Atom, AtomRegistry } from "effect/reactivity";
import { expect, onTestFinished, test } from "vitest";
import { render } from "vitest-browser-svelte";

import { useAtomMount, useAtomSet, useAtomValue } from "../src/index.ts";
import Harness from "./fixtures/harness.svelte";
import Toggle from "./fixtures/toggle.svelte";

const brokenAtom = () =>
  Atom.make((get) => {
    get.addFinalizer(() => {
      throw new Error("finalizer failed");
    });
    return 0;
  });

/** Collects the page's uncaught errors for the rest of the test; vitest then doesn't fail on them. */
const collectPageErrors = (): unknown[] => {
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    event.preventDefault();
    errors.push(event.error);
  };
  window.addEventListener("error", onError);
  onTestFinished(() => window.removeEventListener("error", onError));
  return errors;
};

const messages = (errors: readonly unknown[]) =>
  errors.map((error) => (error instanceof Error ? error.message : error));

test("a call in flight settles as interrupted when disposing of the provider's registry runs a finalizer that throws", async () => {
  const broken = brokenAtom();
  const save = Atom.fn((value: string) =>
    Effect.succeed(value).pipe(Effect.delay("2 seconds"))
  );
  let run!: (value: string) => Promise<Exit.Exit<string>>;
  const screen = await render(Toggle, {
    registry: undefined as never,
    setup: () => {
      useAtomMount(broken);
      run = useAtomSet(save, { mode: "promiseExit" });
      return () => "";
    },
    show: true,
  });
  let exit: Exit.Exit<string> | undefined;
  void run("draft").then((settled) => {
    exit = settled;
  });
  const errors = collectPageErrors();
  await screen.rerender({ show: false });
  await expect.poll(() => exit).toBeDefined();
  expect(
    exit !== undefined &&
      Exit.isFailure(exit) &&
      Cause.hasInterruptsOnly(exit.cause)
  ).toBe(true);
  await expect.poll(() => messages(errors)).toEqual(["finalizer failed"]);
});

test("a finalizer that throws while the provider disposes of its registry is reported without breaking Svelte's teardown", async () => {
  const broken = brokenAtom();
  const screen = await render(Toggle, {
    registry: undefined as never,
    setup: () => {
      useAtomMount(broken);
      return () => "";
    },
    show: true,
  });
  const errors = collectPageErrors();
  // Before the fix the error escaped the unmount itself; caught here so the test fails on what
  // it broke afterwards.
  await screen.rerender({ show: false }).catch((error: unknown) => {
    errors.push(error);
  });
  // Still an uncaught error, reported after the teardown.
  await expect.poll(() => messages(errors)).toEqual(["finalizer failed"]);

  const registry = AtomRegistry.make();
  const atom = Atom.make(1);
  const runs: number[] = [];
  const reader = await render(Harness, {
    registry,
    setup: () => {
      const value = useAtomValue(atom, (n) => {
        runs.push(n);
        return n;
      });
      return () => `${value.current} ${value.current} ${value.current}`;
    },
  });
  await expect
    .element(reader.locator.getByRole("status"))
    .toHaveTextContent("1 1 1");
  registry.set(atom, 2);
  await expect
    .element(reader.locator.getByRole("status"))
    .toHaveTextContent("2 2 2");
  // Once per change, not once per read.
  expect(runs).toEqual([1, 2]);
});
