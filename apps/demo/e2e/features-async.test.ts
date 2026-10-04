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
