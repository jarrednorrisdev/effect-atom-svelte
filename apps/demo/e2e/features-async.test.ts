import type { Page } from "@playwright/test";

import { expect, test } from "./servers.ts";
import { setPressed } from "./toggle.ts";

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
    // A reading takes half a second, which a loaded machine can spend before the check for
    // "waiting" runs, so the page's clock is paused while one is in flight.
    await page.clock.install();
    await page.goto("/async-atoms");
    await page.waitForLoadState("networkidle");
    const match = page.getByTestId("sensor-match");
    const last = page.getByTestId("sensor-last");
    const state = page.getByTestId("sensor-state");
    await expect(state).toHaveText("Success");
    await expect(match).toHaveText(/^\d+ °C$/u);
    // getOrElse shows the same reading, "21 °C".
    const reading = (await match.textContent()) ?? "";
    await expect(last).toHaveText(reading);
    await setPressed(
      page.getByRole("button", { exact: true, name: "Offline" }),
      true
    );
    await expect(state).toHaveText("Failure");
    await expect(match).toHaveText("The sensor is offline");
    // The failure keeps the last success, which getOrElse falls back to.
    await expect(last).toHaveText(reading);
    // The page's clock follows the real one until paused, so a second ahead is never in its past.
    await page.clock.pauseAt(Date.now() + 1000);
    await page.getByRole("button", { name: "Read again" }).click();
    await expect(state).toHaveText("Failure, waiting");
    await page.clock.resume();
    await expect(state).toHaveText("Failure");
    await expect(last).toHaveText(reading);
    await setPressed(
      page.getByRole("button", { exact: true, name: "Offline" }),
      false
    );
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
    const example = page
      .locator("[data-example]")
      .filter({ hasText: "kept.svelte" });
    const runs = (name: string) =>
      page.getByTestId(`cache-${name}`).getByLabel("runs");
    const status = (name: string) => page.getByTestId(`cache-${name}-status`);
    const value = (label: string) => page.getByTestId(`kept-${label}`);
    const go = async (to: "Dashboard" | "Help") => {
      await example.getByRole("button", { exact: true, name: to }).click();
      await expect(
        example.getByRole("button", { exact: true, name: to })
      ).toHaveAttribute("aria-current", "page");
    };

    // The help page reads nothing, so nothing has run yet.
    for (const name of ["weatherAtom", "settingsAtom", "searchAtom"]) {
      await expect(runs(name)).toHaveText("0");
      await expect(status(name)).toHaveText("nothing yet");
    }
    await go("Dashboard");
    await expect(value("Weather")).toHaveText("18 °C, light rain");
    await expect(value("Settings")).toHaveText("Dark theme");
    await expect(value("Search")).toHaveText("3 results for “atoms”");
    for (const name of ["weatherAtom", "settingsAtom", "searchAtom"]) {
      await expect(runs(name)).toHaveText("1");
    }

    // Leaving: plain is disposed at once, keepAlive is kept, the idle TTL counts down.
    await go("Help");
    await expect(status("weatherAtom")).toHaveText(
      "disposed: the next read runs it again"
    );
    await expect(status("settingsAtom")).toHaveText("held: kept alive");
    await expect(status("searchAtom")).toContainText("held, unread for");

    // Back within 3 seconds: only plain runs again.
    await go("Dashboard");
    await expect(value("Weather")).toHaveText("18 °C, light rain");
    await expect(runs("weatherAtom")).toHaveText("2");
    await expect(runs("settingsAtom")).toHaveText("1");
    await expect(runs("searchAtom")).toHaveText("1");

    // Away for longer than the TTL: the search result is disposed and runs again.
    await go("Help");
    // The registry checks idle atoms once a second, so a 3 second TTL ends within 4.
    await expect(status("searchAtom")).toHaveText(
      "disposed: the next read runs it again",
      { timeout: 6000 }
    );
    await expect(status("settingsAtom")).toHaveText("held: kept alive");
    await go("Dashboard");
    await expect(value("Search")).toHaveText("3 results for “atoms”");
    await expect(runs("searchAtom")).toHaveText("2");
    await expect(runs("weatherAtom")).toHaveText("3");
    await expect(runs("settingsAtom")).toHaveText("1");
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
    // Under load, Firefox has taken this click before hydration and ignored it, so it is repeated
    // until the reader appears. Once it has, the button says "Remove the reader" instead.
    const add = page.getByRole("button", { name: "Add a reader" });
    await expect(async () => {
      if (await add.isVisible()) {
        await add.click();
      }
      await expect(page.getByTestId("feed-gone")).toBeHidden({ timeout: 1000 });
    }).toPass();
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
    const promiseRolls = page.getByTestId("promise-rolls");
    const effectRolls = page.getByTestId("effect-rolls");
    // Each click adds what it got back to the list under its button.
    const fromPromise = page.getByTestId("lazy-promise").getByRole("listitem");
    const fromEffect = page.getByTestId("lazy-effect").getByRole("listitem");
    // The promise's die was rolled when the page loaded; the effect's not yet.
    await expect(promiseRolls).toHaveText("1");
    await expect(effectRolls).toHaveText("0");
    const awaitPromise = page.getByRole("button", {
      name: "Await the promise",
    });
    await awaitPromise.click();
    await expect(fromPromise).toHaveText([/^[1-6]$/u]);
    const first = (await fromPromise.first().textContent()) ?? "";
    // Awaiting it again gives back the same settled value, without rolling again.
    await awaitPromise.click();
    await expect(fromPromise).toHaveText([first, first]);
    await expect(promiseRolls).toHaveText("1");
    const run = page.getByRole("button", { name: "Run the effect" });
    await run.click();
    await expect(effectRolls).toHaveText("1");
    await expect(fromEffect).toHaveText([/^[1-6]$/u]);
    await run.click();
    await run.click();
    await expect(effectRolls).toHaveText("3");
    await expect(fromEffect).toHaveCount(3);
    expect(errors).toEqual([]);
  });

  test("catchTag recovers from one error and leaves the other", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await page.goto("/effect-basics");
    await page.waitForLoadState("networkidle");
    // The success's text, or the CauseView of a failure.
    const todo = page.getByTestId("catch-tag");
    // The atom's type, Effect<string, NotFound | Forbidden>: one element per error member, and
    // the member a failure carries is marked failed.
    const type = page
      .locator("[data-example]")
      .filter({ hasText: "catch-tag.svelte" })
      .getByTestId("effect-type");
    const members = type.locator("[data-member]");
    const failed = type.locator(".failed");
    await expect(todo).toHaveText("Write the docs");
    await expect(members).toHaveText(["NotFound", "Forbidden"]);
    await expect(failed).toHaveCount(0);
    await setPressed(
      page.getByRole("button", { exact: true, name: "Todo 2" }),
      true
    );
    await expect(todo).toContainText("NotFound { id: 2 }");
    await expect(failed).toHaveAttribute("data-member", "NotFound");
    await setPressed(
      page.getByRole("button", { exact: true, name: "Todo 3" }),
      true
    );
    await expect(todo).toContainText("Forbidden");
    await expect(failed).toHaveAttribute("data-member", "Forbidden");
    await setPressed(
      page.getByRole("button", {
        exact: true,
        name: 'Effect.catchTag("NotFound", …)',
      }),
      true
    );
    // catchTag takes NotFound out of the type, and leaves Forbidden failing.
    await expect(members).toHaveText(["Forbidden"]);
    await expect(todo).toContainText("Forbidden");
    await expect(failed).toHaveAttribute("data-member", "Forbidden");
    await setPressed(
      page.getByRole("button", { exact: true, name: "Todo 2" }),
      true
    );
    await expect(todo).toHaveText("(there is no todo 2)");
    await expect(failed).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("a schema decodes valid JSON and explains what doesn't match", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await page.goto("/effect-basics");
    await page.waitForLoadState("networkidle");
    const decoded = page.getByTestId("decode");
    // A failure's SchemaError, in a CauseView.
    const cause = page.getByTestId("decode-cause");
    const state = page.getByTestId("decode-state");
    const input = page.getByTestId("decode-input");
    const sample = (name: string) =>
      page
        .getByRole("group", { name: "Sample" })
        .getByRole("button", { exact: true, name });
    await expect(decoded).toHaveText("#1 Write the docs, done: false");
    await expect(state).toHaveText("Success");
    await setPressed(sample("Not an integer"), true);
    await expect(state).toHaveText("Failure");
    await expect(cause).toContainText(
      /SchemaError: Expected an integer\s+at \["id"\]/u
    );
    await setPressed(sample("Missing title"), true);
    await expect(cause).toContainText('at ["title"]');
    // Editing the JSON by hand decodes it too, and no sample matches it any more.
    await input.fill('{ "done": true, "id": 2, "title": "Ship" }');
    await expect(decoded).toHaveText("#2 Ship, done: true");
    await expect(sample("Missing title")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
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
    const log = logEntries(page, "PoolLayer");
    const inUse = page.getByLabel("runtime atoms in use");
    const status = page.getByTestId("pool-status");
    const read = (name: string) =>
      page.getByRole("button", { exact: true, name: `Read ${name}` });
    await expect(page.getByText("No pool yet.", { exact: true })).toBeVisible();
    await expect(status).toHaveText("No pool open");
    await setPressed(read("usersAtom"), true);
    await expect(page.getByTestId("pool-usersAtom")).toHaveText("Uses pool 1");
    await setPressed(read("ordersAtom"), true);
    await expect(page.getByTestId("pool-ordersAtom")).toHaveText("Uses pool 1");
    await expect(inUse).toHaveText("2");
    await expect(status).toHaveText("Holds pool 1, shared by 2 atoms");
    await expect(log).toHaveText([/^0 ms\s*pool 1 built$/u]);
    // One atom still uses the runtime, so the pool stays.
    await setPressed(read("usersAtom"), false);
    await expect(inUse).toHaveText("1");
    await page.waitForTimeout(300);
    await expect(log).toHaveText([/^0 ms\s*pool 1 built$/u]);
    await expect(status).toHaveText("Holds pool 1, shared by 1 atom");
    await setPressed(read("ordersAtom"), false);
    await expect(log).toHaveText([
      /^0 ms\s*pool 1 built$/u,
      /^\d+ ms\s*pool 1 released$/u,
    ]);
    await expect(status).toHaveText("No pool open");
    await setPressed(read("ordersAtom"), true);
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
    await expect(page.getByTestId("weather")).toHaveText("18 °C, cloudy");
    const steps = page.getByTestId("script-steps").getByRole("listitem");
    const notes = page.getByTestId("notes");
    const state = page.getByTestId("notes-state");
    const mount = page.getByRole("button", { name: "Mount the component" });
    const notDone = page
      .getByTestId("script-steps")
      .locator('li:not([data-state="done"])');
    await expect(steps).toHaveText([
      /not reached$/u,
      /not reached$/u,
      /not reached$/u,
    ]);
    // The script waits for 1.5 s, so the boundary shows its pending snippet. Under load
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
    await mount.click();
    await expect(notes).toHaveText("Loaded 1 time");
    expect(await sawPending.evaluate((seen) => seen.pending)).toBe(true);
    await expect(notDone).toHaveCount(0);
    await expect(steps).toHaveText([
      /ran at \d+ ms$/u,
      /ran at \d+ ms$/u,
      /ran at \d+ ms$/u,
    ]);
    const ran = await steps.allTextContents();
    await page.getByRole("button", { name: "Refresh notes" }).click();
    await expect(state).toHaveText("Success, waiting");
    await expect(notes).toHaveText("Loaded 2 times");
    await expect(state).toHaveText("Success");
    // The script didn't run again.
    expect(await steps.allTextContents()).toEqual(ran);
    // A new component waits again; nothing kept the atom, so it loads again.
    await page.getByRole("button", { name: "Unmount the component" }).click();
    await expect(notes).toHaveCount(0);
    await mount.click();
    await expect(steps.nth(1)).toHaveText(/waiting for the first result…$/u);
    await expect(notes).toHaveText("Loaded 3 times");
    await expect(notDone).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("a getter moves the boundary to another atom, keeping the old value meanwhile", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await page.goto("/suspense");
    await page.waitForLoadState("networkidle");
    const weather = page.getByTestId("weather");
    const log = logEntries(page, "Loads");
    const city = (name: string) =>
      page
        .getByRole("group", { name: "City" })
        .getByRole("button", { exact: true, name });
    await expect(weather).toHaveText("18 °C, cloudy");
    await expect(log).toHaveText([
      /^0 ms\s*Paris: loading$/u,
      /^\d+ ms\s*Paris: loaded$/u,
    ]);
    // Every state the boundary shows: its content (with Updating… while an await is pending),
    // or the pending snippet.
    const states = await page.evaluateHandle(() => {
      const seen: string[] = [];
      const read = () => {
        const pending = [
          ...document.querySelectorAll('[data-branch="pending"]'),
        ].some((element) => element.textContent?.includes("weather"));
        const value =
          document
            .querySelector('[data-testid="weather"]')
            ?.textContent?.trim() ?? "";
        const updating = document.querySelector("[data-updating]")
          ? "updating"
          : "";
        const now = pending ? "pending" : `${value}|${updating}`;
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
    });
    await setPressed(city("Tokyo"), true);
    await expect(weather).toHaveText("24 °C, sunny");
    await expect(page.locator("[data-updating]")).toHaveCount(0);
    // The old forecast stayed on screen while the new one loaded, and the pending snippet
    // didn't come back.
    const seen = await states.evaluate((all) => [...all]);
    expect(seen).toContain("18 °C, cloudy|updating");
    expect(seen).not.toContain("pending");
    expect(seen.at(-1)).toBe("24 °C, sunny|");
    // The log has every load that ran, in order.
    await expect(log).toHaveText([
      /^0 ms\s*Paris: loading$/u,
      /^\d+ ms\s*Paris: loaded$/u,
      /^\d+ ms\s*Tokyo: loading$/u,
      /^\d+ ms\s*Tokyo: loaded$/u,
    ]);
    // Moving on before Lima arrives abandons it, and its load is interrupted.
    await setPressed(city("Lima"), true);
    await setPressed(city("Paris"), true);
    await expect(weather).toHaveText("18 °C, cloudy");
    await expect(page.locator("[data-updating]")).toHaveCount(0);
    await expect(city("Paris")).toHaveAttribute("aria-pressed", "true");
    const labels = async () => {
      const entries = await log.allTextContents();
      return entries.map((entry) => entry.replace(/^\s*\d+ ms\s*/u, ""));
    };
    await expect.poll(labels).toContain("Paris: loaded");
    // Under load the second pick can come after Lima has already loaded; only an
    // abandoned load is interrupted.
    const all = await labels();
    const after = all.slice(4);
    const lateSwitch =
      after.includes("Lima: loaded") &&
      after.indexOf("Lima: loaded") < after.indexOf("Paris: loading");
    if (!lateSwitch) {
      await expect.poll(labels).toContain("Lima: interrupted");
      expect(await labels()).not.toContain("Lima: loaded");
    }
    expect(errors).toEqual([]);
  });
});

test.describe("Streams page", () => {
  test("a stream atom ends as a Success, fails keeping its last item, or fails empty", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await page.goto("/streams");
    await page.waitForLoadState("networkidle");
    const latest = page.getByTestId("countdown");
    const state = page.getByTestId("countdown-state");
    const reasons = page.getByTestId("countdown-cause").getByRole("listitem");
    const history = logEntries(page, "Countdown");
    // 3, 2, 1, then the stream ends: a Success that is no longer waiting.
    await expect(state).toHaveText("Success", { timeout: 5000 });
    await expect(latest).toHaveText("1");
    await expect(history.last()).toHaveText(/^\d+ ms\s*Success 1$/u);
    await expect(reasons).toHaveCount(0);
    // A failure after some items keeps the last one.
    await setPressed(
      page.getByRole("button", { exact: true, name: "Fails" }),
      true
    );
    await expect(state).toHaveText("Failure", { timeout: 5000 });
    await expect(latest).toHaveText("1");
    await expect(reasons).toHaveAttribute("data-reason", "Fail");
    await expect(reasons).toContainText("SignalLost");
    // A stream that emits nothing has no item to keep.
    await setPressed(
      page.getByRole("button", { exact: true, name: "Emits nothing" }),
      true
    );
    await expect(state).toHaveText("Failure", { timeout: 5000 });
    await expect(latest).toHaveText("none");
    await expect(reasons).toContainText("NoSuchElementError");
    // Restarting runs the stream again from the beginning.
    await setPressed(
      page.getByRole("button", { exact: true, name: "Ends" }),
      true
    );
    await expect(state).toHaveText("Success", { timeout: 5000 });
    await page.getByRole("button", { name: "Restart" }).click();
    await expect(history).toContainText([
      /Success 1$/u,
      /Success 3, waiting$/u,
    ]);
    await expect(state).toHaveText("Success", { timeout: 5000 });
    await expect(latest).toHaveText("1");
    expect(errors).toEqual([]);
  });
});
