import type { Page } from "@playwright/test";

import { expect, test } from "./servers.ts";

/** Records uncaught page errors, so a test can check an example raised none. */
const pageErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
};

/**
 * Records every distinct combination of the given elements' texts as the page changes, joined
 * with `|`, for states that may pass between two checks under load.
 */
const recordTexts = async (page: Page, testIds: readonly string[]) => {
  const handle = await page.evaluateHandle((ids) => {
    const seen: string[] = [];
    const read = () => {
      const texts = ids.map(
        (id) =>
          document
            .querySelector(`[data-testid="${id}"]`)
            ?.textContent?.trim() ?? ""
      );
      const now = texts.join("|");
      if (seen.at(-1) !== now) {
        seen.push(now);
      }
    };
    read();
    new MutationObserver(read).observe(document.body, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    return seen;
  }, testIds);
  return () => handle.evaluate((seen) => [...seen]);
};

/** A log's entries by its caption, each `<n> ms <label>`. */
const logEntries = (page: Page, name: string) =>
  page.getByRole("list", { name }).getByRole("listitem");

test.describe("Async atoms page", () => {
  test("match follows the state, and getOrElse keeps the last value after a failure", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await page.goto("/async-atoms");
    await page.waitForLoadState("networkidle");
    const match = page.getByTestId("sensor-match");
    const last = page.getByTestId("sensor-last");
    const state = page.getByTestId("sensor-state");
    await expect(state).toHaveText("Success");
    await expect(match).toHaveText(/^\d+ °C$/u);
    // The temperature without its unit, as getOrElse shows it.
    const text = await match.textContent();
    const reading = text?.replace(" °C", "") ?? "";
    await expect(last).toHaveText(reading);
    await page.getByLabel("Offline", { exact: true }).check();
    await expect(state).toHaveText("Failure");
    await expect(match).toHaveText("The sensor is offline");
    // The failure keeps the last success, which getOrElse falls back to.
    await expect(last).toHaveText(reading);
    await page.getByRole("button", { name: "Read again" }).click();
    await expect(state).toHaveText("Failure, waiting");
    await expect(state).toHaveText("Failure");
    await expect(last).toHaveText(reading);
    await page.getByLabel("Offline", { exact: true }).uncheck();
    await expect(state).toHaveText("Success");
    await expect(match).toHaveText(/^\d+ °C$/u);
    expect(errors).toEqual([]);
  });

  test("plain loads again for a new reader, keepAlive never does, and an idle TTL keeps it a while", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await page.goto("/async-atoms");
    await page.waitForLoadState("networkidle");
    for (const name of ["plain", "keepAlive", "idle TTL"]) {
      await expect(page.getByTestId(`kept-${name}`)).toHaveText(
        "Loaded 1 time"
      );
    }
    const toggle = async (name: string) => {
      await page.getByRole("button", { name: `Hide reader: ${name}` }).click();
      await expect(page.getByTestId(`kept-${name}`)).toHaveCount(0);
      await page.getByRole("button", { name: `Show reader: ${name}` }).click();
    };
    await toggle("plain");
    await expect(page.getByTestId("kept-plain")).toHaveText("Loaded 2 times");
    await toggle("keepAlive");
    await expect(page.getByTestId("kept-keepAlive")).toHaveText(
      "Loaded 1 time"
    );
    // Back within 3 seconds: the result was kept.
    await toggle("idle TTL");
    await expect(page.getByTestId("kept-idle TTL")).toHaveText("Loaded 1 time");
    // Away for longer: the result was disposed, and the effect runs again.
    await page.getByRole("button", { name: "Hide reader: idle TTL" }).click();
    // The registry checks idle atoms once a second, so a 3 second TTL ends within 4.
    await page.waitForTimeout(4500);
    await page.getByRole("button", { name: "Show reader: idle TTL" }).click();
    await expect(page.getByTestId("kept-idle TTL")).toHaveText(
      "Loaded 2 times"
    );
    expect(errors).toEqual([]);
  });

  test("an acquired resource is released before a rerun and when the atom is disposed", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await page.goto("/async-atoms");
    await page.waitForLoadState("networkidle");
    const log = logEntries(page, "Socket server");
    await expect(page.getByTestId("feed-gone")).toBeVisible();
    await page.getByRole("button", { name: "Add a reader" }).click();
    await expect(page.getByTestId("feed")).toHaveText(
      "First message on socket 1"
    );
    await expect(log).toHaveText([/^0 ms\s*socket 1 opened$/u]);
    await page.getByRole("button", { name: "Reconnect" }).click();
    await expect(page.getByTestId("feed")).toHaveText(
      "First message on socket 2"
    );
    await expect(log).toHaveText([
      /^0 ms\s*socket 1 opened$/u,
      /^\d+ ms\s*socket 1 closed$/u,
      /^\d+ ms\s*socket 2 opened$/u,
    ]);
    await page.getByRole("button", { name: "Remove the reader" }).click();
    await expect(page.getByTestId("feed-gone")).toBeVisible();
    await expect(log).toHaveText([
      /^0 ms\s*socket 1 opened$/u,
      /^\d+ ms\s*socket 1 closed$/u,
      /^\d+ ms\s*socket 2 opened$/u,
      /^\d+ ms\s*socket 2 closed$/u,
    ]);
    expect(errors).toEqual([]);
  });
});

test.describe("Effect basics page", () => {
  test("a promise runs once when created, and an effect each time it runs", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await page.goto("/effect-basics");
    await page.waitForLoadState("networkidle");
    const promiseRuns = page.getByLabel("A promise runs");
    const effectRuns = page.getByLabel("An effect runs");
    const fromPromise = page.getByTestId("lazy-promise");
    await expect(promiseRuns).toHaveText("1");
    await expect(effectRuns).toHaveText("0");
    await page.getByRole("button", { name: "Await the promise" }).click();
    await expect(fromPromise).toHaveText(/^[1-6]$/u);
    const first = await fromPromise.textContent();
    await page.getByRole("button", { name: "Await the promise" }).click();
    await expect(fromPromise).toHaveText(first ?? "");
    await expect(promiseRuns).toHaveText("1");
    const run = page.getByRole("button", { name: "Run the effect" });
    await run.click();
    await expect(effectRuns).toHaveText("1");
    await expect(page.getByTestId("lazy-effect")).toHaveText(/^[1-6]$/u);
    await run.click();
    await run.click();
    await expect(effectRuns).toHaveText("3");
    expect(errors).toEqual([]);
  });

  test("catchTag recovers from one error and leaves the other", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await page.goto("/effect-basics");
    await page.waitForLoadState("networkidle");
    const todo = page.getByTestId("catch-tag");
    const type = page.getByTestId("catch-tag-type");
    await expect(todo).toHaveText("Write the docs");
    await expect(type).toHaveText("NotFound | Forbidden");
    await page.getByLabel("Todo 2").check();
    await expect(todo).toHaveText("Failed with NotFound");
    await page.getByLabel("Todo 3").check();
    await expect(todo).toHaveText("Failed with Forbidden");
    await page.getByLabel('Effect.catchTag("NotFound", …)').check();
    await expect(type).toHaveText("Forbidden");
    await expect(todo).toHaveText("Failed with Forbidden");
    await page.getByLabel("Todo 2").check();
    await expect(todo).toHaveText("(there is no todo 2)");
    expect(errors).toEqual([]);
  });

  test("a schema decodes valid JSON and explains what doesn't match", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await page.goto("/effect-basics");
    await page.waitForLoadState("networkidle");
    const decoded = page.getByTestId("decode");
    const state = page.getByTestId("decode-state");
    const input = page.getByTestId("decode-input");
    await expect(decoded).toHaveText("#1 Write the docs, done: false");
    await expect(state).toHaveText("Success");
    await page.getByRole("button", { name: "Not an integer" }).click();
    await expect(state).toHaveText("Failure");
    await expect(decoded).toHaveText(/^Expected an integer\s+at \["id"\]$/u);
    await page.getByRole("button", { name: "Missing title" }).click();
    await expect(decoded).toContainText('at ["title"]');
    await input.fill('{ "done": true, "id": 2, "title": "Ship" }');
    await expect(decoded).toHaveText("#2 Ship, done: true");
    await input.fill("{ not json");
    await expect(state).toHaveText("Failure");
    expect(errors).toEqual([]);
  });
});

test.describe("Services page", () => {
  test("a runtime builds its layer once for its atoms, and releases it when none is in use", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await page.goto("/services");
    await page.waitForLoadState("networkidle");
    const log = logEntries(page, "Pool");
    const inUse = page.getByLabel("runtime atoms in use");
    await expect(page.getByText("No pool yet.", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Add a reader of usersAtom" })
      .click();
    await expect(page.getByTestId("pool-usersAtom")).toHaveText("Uses pool 1");
    await page
      .getByRole("button", { name: "Add a reader of ordersAtom" })
      .click();
    await expect(page.getByTestId("pool-ordersAtom")).toHaveText("Uses pool 1");
    await expect(inUse).toHaveText("2");
    await expect(log).toHaveText([/^0 ms\s*pool 1 built$/u]);
    // One atom still uses the runtime, so the pool stays.
    await page
      .getByRole("button", { name: "Remove a reader of usersAtom" })
      .click();
    await expect(inUse).toHaveText("1");
    await page.waitForTimeout(300);
    await expect(log).toHaveText([/^0 ms\s*pool 1 built$/u]);
    await page
      .getByRole("button", { name: "Remove a reader of ordersAtom" })
      .click();
    await expect(log).toHaveText([
      /^0 ms\s*pool 1 built$/u,
      /^\d+ ms\s*pool 1 released$/u,
    ]);
    await page
      .getByRole("button", { name: "Add a reader of ordersAtom" })
      .click();
    await expect(page.getByTestId("pool-ordersAtom")).toHaveText("Uses pool 2");
    await expect(log).toHaveText([
      /^0 ms\s*pool 1 built$/u,
      /^\d+ ms\s*pool 1 released$/u,
      /^\d+ ms\s*pool 2 built$/u,
    ]);
    expect(errors).toEqual([]);
  });
});

test.describe("Suspense page", () => {
  test("useAtomResult waits in the script once, then current follows the atom", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await page.goto("/suspense");
    await page.waitForLoadState("networkidle");
    // The page has settled: the other examples' first loads are done.
    await expect(page.getByTestId("follow-note")).toHaveText("Note 1");
    const script = logEntries(page, "Script");
    const notes = page.getByTestId("notes");
    const state = page.getByTestId("notes-state");
    // The script waits for 800 ms, so the boundary shows its pending snippet. Under load
    // that can pass between two checks, so watch the page for it instead.
    const sawPending = await page.evaluateHandle(() => {
      const seen = { pending: false };
      const observer = new MutationObserver(() => {
        if (document.querySelector('[data-testid="notes-pending"]')) {
          seen.pending = true;
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return seen;
    });
    await page.getByRole("button", { name: "Mount the component" }).click();
    await expect(notes).toHaveText("Loaded 1 time");
    expect(await sawPending.evaluate((seen) => seen.pending)).toBe(true);
    await expect(script).toHaveText([
      /^0 ms\s*script started$/u,
      /^\d+ ms\s*script continued after the await$/u,
    ]);
    await page.getByRole("button", { name: "Refresh notes" }).click();
    await expect(state).toHaveText("Success, waiting");
    await expect(notes).toHaveText("Loaded 2 times");
    await expect(state).toHaveText("Success");
    // The script didn't run again.
    await expect(script).toHaveCount(2);
    // A new component waits again; nothing kept the atom, so it loads again.
    await page.getByRole("button", { name: "Unmount the component" }).click();
    await expect(page.getByText("Not mounted.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Mount the component" }).click();
    await expect(notes).toHaveText("Loaded 3 times");
    await expect(script).toHaveCount(2);
    expect(errors).toEqual([]);
  });

  test("a getter moves the boundary to another atom, keeping the old value meanwhile", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await page.goto("/suspense");
    await page.waitForLoadState("networkidle");
    const note = page.getByTestId("follow-note");
    const pending = page.getByTestId("follow-pending");
    const log = logEntries(page, "Note effects");
    await expect(note).toHaveText("Note 1");
    await expect(log).toHaveText([
      /^0 ms\s*note 1 started$/u,
      /^\d+ ms\s*note 1 loaded$/u,
    ]);
    const states = await recordTexts(page, ["follow-pending", "follow-note"]);
    await page.getByLabel("Note 2").check();
    await expect(note).toHaveText("Note 2");
    await expect(pending).toHaveText("0");
    // The old note stayed on screen while the new one loaded, with an await pending.
    // (Within a single task the count can step through other values; those are never
    // painted, so only the order is checked.)
    const seen = await states();
    expect(seen).toContain("1|Note 1");
    expect(seen.filter((state) => state.endsWith("Note 2"))).toEqual([
      "0|Note 2",
    ]);
    expect(seen.at(-1)).toBe("0|Note 2");
    // The log has every effect that ran, in order.
    await expect(log).toHaveText([
      /^0 ms\s*note 1 started$/u,
      /^\d+ ms\s*note 1 loaded$/u,
      /^\d+ ms\s*note 2 started$/u,
      /^\d+ ms\s*note 2 loaded$/u,
    ]);
    // Moving on before note 3 arrives abandons it, and its effect is interrupted.
    await page.getByLabel("Note 3").check();
    await page.getByLabel("Note 1").check();
    await expect(note).toHaveText("Note 1");
    await expect(pending).toHaveText("0");
    await expect(page.getByLabel("Note 1")).toBeChecked();
    const labels = async () => {
      const entries = await log.allTextContents();
      return entries.map((entry) => entry.replace(/^\s*\d+ ms\s*/u, ""));
    };
    await expect.poll(labels).toContain("note 1 loaded");
    // Under load the second pick can come after note 3 has already loaded; only an
    // abandoned note is interrupted.
    const all = await labels();
    const after = all.slice(4);
    const lateSwitch =
      after.includes("note 3 loaded") &&
      after.indexOf("note 3 loaded") < after.indexOf("note 1 started");
    if (!lateSwitch) {
      await expect.poll(labels).toContain("note 3 interrupted");
      expect(await labels()).not.toContain("note 3 loaded");
    }
    expect(errors).toEqual([]);
  });
});
