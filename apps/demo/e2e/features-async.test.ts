import type { Page } from "@playwright/test";

import { expect, test } from "./servers.ts";

/** Records uncaught page errors, so a test can check an example raised none. */
const pageErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
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
