// Its own file: the finalizer's error escapes the provider's teardown and aborts the Svelte flush
// that unmounts it, which leaves Svelte's scheduler broken for the rest of the page: later tests in
// the same file saw each $derived run again on every read.
import { Cause, Effect, Exit } from "effect";
import { Atom } from "effect/reactivity";
import { expect, onTestFinished, test } from "vitest";
import { render } from "vitest-browser-svelte";

import { useAtomMount, useAtomSet } from "../src/index.ts";
import Toggle from "./fixtures/toggle.svelte";

test("a call in flight settles as interrupted when disposing of the provider's registry runs a finalizer that throws", async () => {
  const broken = Atom.make((get) => {
    get.addFinalizer(() => {
      throw new Error("finalizer failed");
    });
    return 0;
  });
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
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    event.preventDefault();
    errors.push(event.error);
  };
  window.addEventListener("error", onError);
  onTestFinished(() => window.removeEventListener("error", onError));
  await screen.rerender({ show: false }).catch((error: unknown) => {
    errors.push(error);
  });
  await expect.poll(() => exit).toBeDefined();
  expect(
    exit !== undefined &&
      Exit.isFailure(exit) &&
      Cause.hasInterruptsOnly(exit.cause)
  ).toBe(true);
});
