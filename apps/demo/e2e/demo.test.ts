import { setTimeout as delay } from "node:timers/promises";

import type { Page } from "@playwright/test";

import { pages as navPages } from "../src/lib/docs/nav.ts";
import { expect, test } from "./servers.ts";
import { setPressed } from "./toggle.ts";

// Every page in the sidebar.
const pages = navPages.map((page) => page.href);

/** The server's HTML for `path`, requested with the page's cookies, before any script runs. */
const serverHtml = async (page: Page, path: string) => {
  const response = await page.request.get(path);
  return response.text();
};

/** Records page errors and RPC/HTTP API calls for the life of the page. */
const watch = (page: Page) => {
  const errors: string[] = [];
  const logged: Promise<string>[] = [];
  const calls: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      // Firefox's text for a logged Error is just "Error", so read the logged values themselves.
      logged.push(
        Promise.all(
          message.args().map((arg) => arg.evaluate((value) => `${value}`))
        ).then(
          (values) => values.join(" "),
          () => message.text()
        )
      );
    }
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/rpc")) {
      const tag =
        /"tag":"(?<tag>\w+)"/u.exec(request.postData() ?? "")?.groups?.tag ??
        "?";
      calls.push(`rpc ${tag}`);
    } else if (url.pathname.startsWith("/api/")) {
      calls.push(`${request.method()} ${url.pathname}${url.search}`);
    }
  });
  return {
    calls,
    errors: async () => [...errors, ...(await Promise.all(logged))],
  };
};

for (const path of pages) {
  test(`${path} renders on the server and hydrates without errors`, async ({
    page,
  }) => {
    const { errors } = watch(page);
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await page.waitForLoadState("networkidle");
    // The suspense page fails one atom on purpose, and the handleError hook logs it.
    const all = await errors();
    const unexpected = all.filter(
      (error) => !error.includes("This atom always fails")
    );
    expect(unexpected).toEqual([]);
  });
}

test.describe("RPC page", () => {
  test("the server HTML already contains the todos and their hydration payload", async ({
    request,
  }) => {
    const response = await request.get("/rpc");
    const html = await response.text();
    expect(html).toContain("Read the Effect Atom source");
    expect(html).toContain("AtomRpc:listTodos:rpc-todos");
  });

  test("hydration shows the server's todos without waiting on the network", async ({
    page,
  }) => {
    const { calls } = watch(page);
    await page.route("**/api/rpc{,/}", async (route) => {
      // Hold every RPC so anything the page shows must have come from the server render.
      await delay(1500);
      await route.continue();
    });
    await page.goto("/rpc");
    await expect(page.getByTestId("rpc-todos")).toContainText(
      "Read the Effect Atom source",
      {
        timeout: 500,
      }
    );
    // A hydrated query is not fetched again in the browser, reactivity keys and all (JND-19).
    await page.waitForTimeout(2000);
    expect(calls.filter((call) => call === "rpc listTodos")).toEqual([]);
  });

  test("a slow mutation shows as waiting until it settles", async ({
    page,
  }) => {
    // The demo API runs without latency in e2e; hold the request here instead.
    const held = Promise.withResolvers<undefined>();
    await page.route("**/api/rpc{,/}", async (route) => {
      if (route.request().postData()?.includes('"tag":"createTodo"')) {
        await held.promise;
      }
      await route.continue();
    });
    await page.goto("/rpc");
    // Typed before hydration, the title was lost in WebKit on CI and an empty todo was added.
    await expect(page.locator("html[data-hydrated]")).toBeAttached();

    await page.getByTestId("rpc-draft").fill("Slow todo");
    await page.getByTestId("rpc-add").click();
    await expect(page.getByTestId("rpc-add")).toBeDisabled();
    await expect(page.getByTestId("rpc-add-state")).toHaveText(
      "Initial, waiting"
    );
    held.resolve(undefined);
    await expect(page.getByTestId("rpc-add")).toBeEnabled();
    await expect(page.getByTestId("rpc-add-state")).toHaveText("Success");
    await expect(page.getByTestId("rpc-todos")).toContainText("Slow todo");
  });

  test("a draft typed before hydration survives it", async ({ page }) => {
    const { errors } = watch(page);
    // Hold the app's scripts, so the server's input is on screen but not yet hydrated.
    const held = Promise.withResolvers<undefined>();
    await page.route("**/_app/immutable/**/*.js", async (route) => {
      await held.promise;
      await route.continue();
    });
    await page.goto("/rpc", { waitUntil: "domcontentloaded" });
    const draft = page.getByTestId("rpc-draft");
    await draft.fill("Early todo");
    await expect(page.locator("html[data-hydrated]")).not.toBeAttached();
    held.resolve(undefined);
    await expect(page.locator("html[data-hydrated]")).toBeAttached();
    await page.waitForLoadState("networkidle");
    // Svelte's bind:value keeps text typed before hydration (JND-92).
    await expect(draft).toHaveValue("Early todo");
    expect(await errors()).toEqual([]);
  });

  test("a mutation's reactivity key sends the query to waiting, then back", async ({
    page,
  }) => {
    await page.goto("/rpc");
    await page.waitForLoadState("networkidle");
    const state = page.getByTestId("rpc-todos-state");
    await expect(state).toHaveText("Success");
    // Hold the list's refetch, so its waiting state stays on screen.
    const held = Promise.withResolvers<undefined>();
    await page.route("**/api/rpc{,/}", async (route) => {
      if (route.request().postData()?.includes('"tag":"listTodos"')) {
        await held.promise;
      }
      await route.continue();
    });
    await page.getByTestId("rpc-draft").fill("Invalidate the list");
    await page.getByTestId("rpc-add").click();
    await expect(state).toHaveText("Success, waiting");
    await expect(page.getByTestId("rpc-todos")).toHaveAttribute(
      "aria-busy",
      "true"
    );
    held.resolve(undefined);
    await expect(state).toHaveText("Success");
    await expect(page.getByTestId("rpc-todos")).toContainText(
      "Invalidate the list"
    );
  });

  test("add, typed error, toggle and the query family", async ({ page }) => {
    await page.goto("/rpc");
    await page.waitForLoadState("networkidle");
    const list = page.getByTestId("rpc-todos");
    const before = await list.locator("li").count();

    await page.getByTestId("rpc-draft").fill("Added over RPC");
    await page.getByTestId("rpc-add").click();
    await expect(list.locator("li")).toHaveCount(before + 1);
    await expect(list).toContainText("Added over RPC");

    await page.getByTestId("rpc-draft").fill("x".repeat(80));
    await page.getByTestId("rpc-add").click();
    await expect(page.getByTestId("rpc-error")).toHaveText(
      "TitleTooLong: the limit is 60 characters"
    );
    await expect(page.getByTestId("rpc-add-state")).toHaveText("Failure");

    const checkbox = list.locator("li").first().getByRole("checkbox");
    const checked = await checkbox.isChecked();
    await checkbox.click();
    await expect(checkbox).toBeChecked({ checked: !checked });

    await expect(page.getByTestId("rpc-selected")).toContainText(
      "Read the Effect Atom source"
    );
    await page.getByTestId("rpc-select").selectOption("2");
    await expect(page.getByTestId("rpc-selected")).toContainText(
      "Write a Svelte adapter"
    );
    await page.getByTestId("rpc-select").selectOption("99");
    await expect(page.getByTestId("rpc-selected")).toHaveText(
      "TodoNotFound: there is no todo 99"
    );
  });

  test("a streaming RPC pulls to the end", async ({ page }) => {
    await page.goto("/rpc");
    await page.waitForLoadState("networkidle");
    const ticks = page.getByTestId("ticks");
    const pull = page.getByRole("button", { name: "Pull next" });
    // HTTP RPC has no acks, so the server streams ahead and a pull takes every item that has
    // arrived since the last one, the first pull included. Each must add items in order.
    const done = "0, 1, 2, 3, 4 (done)";
    await expect(ticks).toHaveText(/^0/u);
    let shown = (await ticks.textContent()) ?? "";
    expect(done.startsWith(shown.replace(" (done)", ""))).toBe(true);
    for (let click = 0; click < 5 && shown !== done; click += 1) {
      await pull.click();
      await expect(ticks).not.toHaveText(shown);
      const next = (await ticks.textContent()) ?? "";
      expect(next.startsWith(shown), `${next} extends ${shown}`).toBe(true);
      expect(done.startsWith(next.replace(" (done)", ""))).toBe(true);
      shown = next;
    }
    expect(shown).toBe(done);
    await expect(pull).toBeDisabled();
    // Each pull shows in the history, the last one with every item.
    const pulls = page.getByTestId("ticks-history").getByRole("listitem");
    await expect(pulls.last()).toContainText("Success 0, 1, 2, 3, 4");

    // Start over calls the procedure again: a new stream, from 0.
    const { calls } = watch(page);
    await page.getByRole("button", { name: "Start over" }).click();
    await expect(ticks).toHaveText(/^0(?:, \d)*$/u);
    await expect(pull).toBeEnabled();
    expect(calls).toContain("rpc ticks");
  });
});

test.describe("HTTP API page", () => {
  test("the server HTML already contains the todos", async ({ request }) => {
    const response = await request.get("/http");
    const html = await response.text();
    expect(html).toContain("Write a Svelte adapter");
  });

  test("filters switch the query through a getter", async ({ page }) => {
    await page.goto("/http");
    await page.waitForLoadState("networkidle");
    const list = page.getByTestId("http-todos");
    // Check what each filter means rather than which titles show.
    // Wait for the filtered items before asserting what is absent: an empty list mid-update would
    // otherwise satisfy "no open items" on its own.
    const done = list.locator("li").filter({ hasText: "✔" });
    const open = list.locator("li").filter({ hasText: "○" });
    await page.getByTestId("http-filter").selectOption("true");
    await expect(done.first()).toBeVisible({ timeout: 15_000 });
    await expect(open).toHaveCount(0);
    await page.getByTestId("http-filter").selectOption("false");
    await expect(open.first()).toBeVisible({ timeout: 15_000 });
    await expect(done).toHaveCount(0);
  });

  test("a slow create disables Add and shows waiting until it settles", async ({
    page,
  }) => {
    const held = Promise.withResolvers<undefined>();
    await page.route("**/api/todos", async (route) => {
      if (route.request().method() === "POST") {
        await held.promise;
      }
      await route.continue();
    });
    await page.goto("/http");
    await page.waitForLoadState("networkidle");
    const add = page.getByTestId("http-add");
    const state = page.getByTestId("http-add-state");
    await expect(state).toHaveText("Initial");
    await page.getByTestId("http-draft").fill("Slow over HTTP");
    await add.click();
    await expect(add).toBeDisabled();
    await expect(state).toHaveText("Initial, waiting");
    held.resolve(undefined);
    await expect(add).toBeEnabled();
    await expect(state).toHaveText("Success");
    await expect(page.getByTestId("http-todos")).toContainText(
      "Slow over HTTP"
    );
  });

  test("create refreshes the list, and a typed 404", async ({ page }) => {
    await page.goto("/http");
    await page.waitForLoadState("networkidle");
    const list = page.getByTestId("http-todos");

    await page.getByTestId("http-draft").fill("Added over HTTP");
    await page.getByTestId("http-add").click();
    await expect(list).toContainText("Added over HTTP");
    await expect(page.getByTestId("http-add-state")).toHaveText("Success");
    await page.getByTestId("http-draft").fill("y".repeat(80));
    await page.getByTestId("http-add").click();
    await expect(page.getByTestId("http-error")).toHaveText(
      "TitleTooLong: the limit is 60 characters"
    );
    await expect(page.getByTestId("http-add-state")).toHaveText("Failure");

    await page.getByTestId("http-id").fill("999");
    await expect(page.getByTestId("http-found")).toHaveText(
      "TodoNotFound: there is no todo 999"
    );
    await page.getByTestId("http-id").fill("1");
    await expect(page.getByTestId("http-found")).toContainText(
      "Read the Effect Atom source"
    );
  });
});

test("hydration: the browser uses the server's result until it computes again", async ({
  page,
}) => {
  await page.goto("/hydration");
  await page.waitForLoadState("networkidle");
  const browserPart = page.getByTestId("where-browser");
  const history = page.getByTestId("where-history").getByRole("listitem");
  await expect(page.getByTestId("where-server")).toContainText(
    "Rendered on the server"
  );
  await expect(browserPart).toContainText("Hydrated, not computed");
  // Give a refetch, if there were one, time to land.
  await page.waitForTimeout(600);
  await expect(browserPart).toContainText("Hydrated, not computed");
  // Hydrated, the atom never had a loading state: its history starts at Success.
  await expect(history).toHaveCount(1);
  await expect(history.first()).toHaveText(/^0 ms\s*Success the server$/u);
  await page.getByRole("button", { name: "Compute again" }).click();
  await expect(browserPart).toContainText("Computed in the browser");
  await expect(page.getByTestId("where-state")).toHaveText("Success");
  await expect(history.nth(1)).toContainText("Success the server, waiting");
  await expect(history.nth(2)).toContainText("Success the browser");
});

test("introduction: a count, its double and an Effect's greeting", async ({
  page,
}) => {
  // The server renders the boundary's pending state; the browser runs the Effect.
  expect(await serverHtml(page, "/")).toMatch(
    /data-tone="running"[^>]*><span class="content[^"]*">(?:<!---->)*Loading…/u
  );
  await page.goto("/");
  await expect(page.getByTestId("taste-greeting")).toHaveText(
    "Hello from an Effect"
  );
  await page.waitForLoadState("networkidle");
  const add = page.getByRole("button", { name: "Add one" });
  await add.click();
  await add.click();
  await expect(page.getByTestId("taste-count")).toHaveText("2");
  // doubledAtom follows countAtom.
  await expect(page.getByTestId("taste-doubled")).toHaveText("4");
});

test("first atom: two counters share one atom", async ({ page }) => {
  await page.goto("/first-atom");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "First counter: increment" }).click();
  await page.getByRole("button", { name: "Second counter: increment" }).click();
  await expect(page.locator("[data-example] output")).toHaveText(["2", "2"]);
  // Nothing reads the atom while the counters are hidden, so it starts again.
  await page.getByRole("button", { name: "Hide counters" }).click();
  await expect(page.locator("[data-example] output")).toHaveCount(0);
  await expect(page.getByText("Nothing reads countAtom now")).toBeVisible();
  await page.getByRole("button", { name: "Show counters" }).click();
  await expect(page.locator("[data-example] output")).toHaveText(["0", "0"]);
});

test("reading and writing: read, write, transform, update and bind", async ({
  page,
}) => {
  await page.goto("/reading-and-writing");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "+" }).click();
  await expect(page.getByTestId("count")).toHaveText("1");
  await expect(page.getByTestId("parity")).toHaveText("odd");
  await page.getByRole("button", { name: "+" }).click();
  await expect(page.getByTestId("count")).toHaveText("2");
  await expect(page.getByTestId("parity")).toHaveText("even");
  await page.getByRole("button", { name: "Multiply by 10" }).click();
  await expect(page.getByTestId("count")).toHaveText("20");
  await page.getByTestId("name").fill("Effect");
  await expect(page.getByTestId("greeting")).toHaveText("Hello, Effect!");
  await page.getByTestId("name").fill("");
  await expect(page.getByTestId("greeting")).toHaveText("Hello, nobody!");
});

test("derived atoms: a read-only and a writable derived atom", async ({
  page,
}) => {
  await page.goto("/derived-atoms");
  await expect(page.locator("html[data-hydrated]")).toBeAttached();
  const celsius = page.getByTestId("celsius");
  const fahrenheit = page.getByTestId("fahrenheit");
  const feel = page.getByTestId("feel");
  const press = (name: string) =>
    page.getByRole("button", { exact: true, name }).click();
  await expect(fahrenheit).toHaveText("68");
  await expect(feel).toHaveText("mild");
  await press("Celsius: add 10");
  await expect(celsius).toHaveText("30");
  await expect(fahrenheit).toHaveText("86");
  await expect(feel).toHaveText("hot");
  // Writing the derived atom writes the atom it reads from.
  const fahrenheitDown = async (f: string, c: string) => {
    await press("Fahrenheit: subtract 10");
    await expect(fahrenheit).toHaveText(f);
    await expect(celsius).toHaveText(c);
  };
  await fahrenheitDown("76", "24.4");
  await fahrenheitDown("66", "18.9");
  await fahrenheitDown("56", "13.3");
  await fahrenheitDown("46", "7.8");
  await expect(feel).toHaveText("cold");
});

test("families: a list and a details panel share each todo's atom", async ({
  page,
}) => {
  await page.goto("/families");
  await page.waitForLoadState("networkidle");
  const title = page.getByTestId("details-title");
  const status = page.getByTestId("details-status");
  await expect(title).toHaveText("Buy milk");
  await expect(status).toHaveText("open");
  // Ticking the row writes todoAtom(1), which the panel reads too.
  await page.getByRole("checkbox", { name: "Buy milk done" }).check();
  await expect(status).toHaveText("done");
  // Opening another todo moves the panel to that todo's atom.
  await page.getByRole("button", { name: "Walk the dog" }).click();
  await expect(title).toHaveText("Walk the dog");
  await expect(status).toHaveText("open");
  await setPressed(
    page.getByRole("button", { exact: true, name: "Done" }),
    true
  );
  await expect(
    page.getByRole("checkbox", { name: "Walk the dog done" })
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Buy milk done" })
  ).toBeChecked();
  // A new id gets a new atom.
  await page.getByRole("textbox", { name: "New todo" }).fill("Call mum");
  await page.getByRole("button", { exact: true, name: "Add" }).click();
  await expect(title).toHaveText("Call mum");
  await expect(status).toHaveText("open");
  await expect(
    page.getByRole("checkbox", { name: "Call mum done" })
  ).not.toBeChecked();
});

test("effect basics: tryPromise hashes the text, and a rejection is a typed error", async ({
  page,
}) => {
  await page.goto("/effect-basics");
  await page.waitForLoadState("networkidle");
  const hash = page.getByTestId("hash");
  // SHA-256 of "Hello, Effect".
  await expect(hash).toHaveText(
    "f8cd9e3207ac367ea0e7c10ad4a0bd0551f73dd1e2ddbe556b74850a2db39b70"
  );
  await page.getByTestId("hash-text").fill("abc");
  await expect(hash).toHaveText(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
  await expect(page.getByTestId("hash-state")).toHaveText("Success");
  await page.getByTestId("hash-algorithm").selectOption("MD5");
  await expect(hash).toHaveText("UnsupportedAlgorithm: Web Crypto has no MD5");
  await expect(page.getByTestId("hash-state")).toHaveText("Failure");
  await page.getByTestId("hash-algorithm").selectOption("SHA-1");
  await expect(hash).toHaveText("a9993e364706816aba3e25717850c26c9cd0d89d");
});

test("effect basics: removing the reader aborts the request's signal", async ({
  page,
}) => {
  // The pretend server answers after two seconds, which a loaded machine can spend between
  // adding and removing the reader, so stop the page's clock while the request is in flight.
  await page.clock.install();
  await page.goto("/effect-basics");
  await page.waitForLoadState("networkidle");
  const state = page.getByTestId("request-state");
  const server = page
    .getByRole("list", { name: "Server" })
    .getByRole("listitem");
  // The page's clock follows the real one until paused, so a second ahead is never in its past.
  await page.clock.pauseAt(Date.now() + 1000);
  await page.getByRole("button", { name: "Add a reader" }).click();
  await expect(state).toHaveText("Initial, waiting");
  await expect(server).toHaveText([/^0 ms\s*request received$/u]);
  await page.getByRole("button", { name: "Remove the reader" }).click();
  await page.clock.resume();
  await expect(server).toHaveText([
    /^0 ms\s*request received$/u,
    /^\d+ ms\s*signal aborted, request dropped$/u,
  ]);
  // Left alone, the request answers after two seconds.
  await page.getByRole("button", { name: "Add a reader" }).click();
  await expect(page.getByTestId("request")).toHaveText("Here is your data", {
    timeout: 5000,
  });
  await expect(state).toHaveText("Success");
  await expect(server).toHaveText([
    /^0 ms\s*request received$/u,
    /^\d+ ms\s*response sent$/u,
  ]);
});

test("errors: typed errors match on _tag, and a defect is told apart", async ({
  page,
}) => {
  await page.goto("/errors");
  await page.waitForLoadState("networkidle");
  const message = page.getByTestId("outcome-message");
  const outcome = page.getByTestId("outcome");
  const state = page.getByTestId("outcome-state");
  // The cause's reasons: Fail for a typed error, Die for a defect, Interrupt.
  const reasons = page.getByTestId("outcome-cause").getByRole("listitem");
  await expect(message).toHaveText("NotFound: there is no todo 7");
  await expect(state).toHaveText("Failure");
  await expect(reasons).toHaveCount(1);
  await expect(reasons).toHaveAttribute("data-reason", "Fail");
  await expect(reasons).toContainText("NotFound { id: 7 }");
  await setPressed(
    outcome.getByRole("button", { exact: true, name: "Fail with Forbidden" }),
    true
  );
  await expect(message).toHaveText("Forbidden: you can't see this todo");
  await expect(reasons).toHaveAttribute("data-reason", "Fail");
  await expect(reasons).toContainText("Forbidden");
  await setPressed(
    outcome.getByRole("button", { exact: true, name: "Die with a defect" }),
    true
  );
  await expect(message).toHaveText(
    "Something went wrong: Error: todos is undefined"
  );
  await expect(reasons).toHaveAttribute("data-reason", "Die");
  await expect(reasons).toContainText("Error: todos is undefined");
  await expect(reasons).toContainText("defect, not in the type");
  await setPressed(
    outcome.getByRole("button", { exact: true, name: "Be interrupted" }),
    true
  );
  await expect(message).toHaveText(/^Something went wrong: /u);
  await expect(reasons).toHaveAttribute("data-reason", "Interrupt");
  await setPressed(
    outcome.getByRole("button", { exact: true, name: "Succeed" }),
    true
  );
  await expect(message).toHaveText("Write the docs");
  await expect(state).toHaveText("Success");
  await expect(reasons).toHaveCount(0);
  await expect(page.getByTestId("outcome-cause")).toContainText(
    "No failure, so no cause."
  );
});

test("async atoms: initial, success and a refresh that keeps the value", async ({
  page,
}) => {
  await page.goto("/async-atoms");
  await page.waitForLoadState("networkidle");
  const state = page.getByTestId("die-state");
  // Every state the atom has been through, in order, with its time.
  const history = page
    .getByRole("list", { name: "History" })
    .getByRole("listitem");
  await expect(state).toHaveText("Success");
  await expect(page.getByTestId("die")).toHaveText(/^[1-6]$/u);
  await expect(history).toHaveText([
    /^0 ms\s*Initial, waiting$/u,
    /^\d+ ms\s*Success [1-6]$/u,
  ]);
  await page.getByRole("button", { name: "Roll again" }).click();
  // The previous roll stays on screen while the new one runs: "Success n, waiting" in the
  // history. (The 600 ms waiting state itself can pass between two polls under load.)
  await expect(history).toHaveText([
    /^0 ms\s*Initial, waiting$/u,
    /^\d+ ms\s*Success [1-6]$/u,
    /^\d+ ms\s*Success [1-6], waiting$/u,
    /^\d+ ms\s*Success [1-6]$/u,
  ]);
  await expect(state).toHaveText("Success");
  await expect(page.getByTestId("die")).toHaveText(/^[1-6]$/u);
  // The atom reads the checkbox's atom, so ticking it runs the effect again, which fails.
  await setPressed(
    page.getByRole("button", { exact: true, name: "Drop the die" }),
    true
  );
  await expect(state).toHaveText("Failure");
  await expect(page.getByTestId("die-failure")).toBeVisible();
  await setPressed(
    page.getByRole("button", { exact: true, name: "Drop the die" }),
    false
  );
  await expect(state).toHaveText("Success");
  await expect(page.getByTestId("die")).toHaveText(/^[1-6]$/u);
  // The history shows the six most recent states.
  await expect(history).toHaveText([
    /^\d+ ms\s*Success [1-6], waiting$/u,
    /^\d+ ms\s*Success [1-6]$/u,
    /^\d+ ms\s*Success [1-6], waiting$/u,
    /^\d+ ms\s*Failure$/u,
    /^\d+ ms\s*Failure, waiting$/u,
    /^\d+ ms\s*Success [1-6]$/u,
  ]);
});

test("services: a runtime's atoms use its layer, and run again when the layer changes", async ({
  page,
}) => {
  await page.goto("/services");
  await page.waitForLoadState("networkidle");
  const die = page.getByTestId("service-die");
  await expect(die).toHaveText(/^[1-6]$/u);
  await expect(page.getByTestId("service-layer")).toHaveText("Dice.fair");
  await setPressed(
    page.getByRole("button", { exact: true, name: "Loaded dice" }),
    true
  );
  await expect(page.getByTestId("service-layer")).toHaveText("Dice.loaded");
  await expect(die).toHaveText("6");
  await expect(page.getByTestId("service-state")).toHaveText("Success");
  // A fair die rolls three sixes in a row once in 216 runs; the loaded one always does.
  const rollAndWait = async () => {
    await page.getByRole("button", { name: "Roll again" }).click();
    await expect(die).toHaveAttribute("aria-busy", "true");
    await expect(die).toHaveAttribute("aria-busy", "false");
    await expect(die).toHaveText("6");
  };
  await rollAndWait();
  await rollAndWait();
});

/** The time of a timeline dot, `<label> at <n> ms`. */
const dotTime = async (dot: ReturnType<Page["getByRole"]>) => {
  const text = await dot.textContent();
  return Number(/at (?<ms>\d+) ms\s*$/u.exec(text ?? "")?.groups?.ms);
};

test("suspense: pending, value, refresh and failure", async ({ page }) => {
  await page.goto("/suspense");
  await page.waitForLoadState("networkidle");

  // The opener: the boundary shows its pending snippet until the forecast arrives.
  const forecast = page.getByTestId("forecast");
  const forecastPending = page.locator('[data-branch="pending"]', {
    hasText: "Loading the forecast…",
  });
  await expect(forecast).toHaveCount(0);
  await page.getByRole("button", { name: "Mount the forecast" }).click();
  await expect(forecastPending).toBeVisible();
  await expect(forecast).toHaveText("18 °C, cloudy");
  await expect(forecastPending).toHaveCount(0);
  // Nothing kept the atom, so a new mount loads it again.
  await page.getByRole("button", { name: "Unmount the forecast" }).click();
  await expect(forecast).toHaveCount(0);
  await page.getByRole("button", { name: "Mount the forecast" }).click();
  await expect(forecastPending).toBeVisible();
  await expect(forecast).toHaveText("18 °C, cloudy");

  // Refreshing: the default await resolves at once with the old value, then with the new one;
  // the suspendOnWaiting one waits for the new value, and the boundary counts it as pending.
  const value = page.getByTestId("suspense-value");
  const held = page.getByTestId("held-value");
  await expect(value).toHaveText("Loaded 1 time");
  await expect(held).toHaveText("Loaded 1 time");
  await expect(page.getByTestId("plainAtom-state")).toHaveText("Success");
  await expect(page.getByTestId("waitingAtom-state")).toHaveText("Success");
  const awaits = page.getByRole("list", { exact: true, name: "await" });
  const plainAwait = awaits.nth(0).getByRole("listitem");
  const heldAwait = awaits.nth(1).getByRole("listitem");
  await page.getByRole("button", { name: "Refresh both" }).click();
  // Only visible in flight, so checked first. The refresh takes two seconds.
  await expect(page.getByTestId("held-pending")).toHaveText("1");
  await expect(page.getByTestId("plainAtom-caption")).toHaveText(
    "The await resolved at once, with the old value."
  );
  await expect(page.getByTestId("waitingAtom-caption")).toHaveText(
    "The await is waiting for the new value."
  );
  await expect(value).toHaveText("Loaded 1 time");
  await expect(held).toHaveText("Loaded 1 time");
  await expect(value).toHaveText("Loaded 2 times");
  await expect(held).toHaveText("Loaded 2 times");
  await expect(page.getByTestId("held-pending")).toHaveText("0");
  await expect(page.getByTestId("plainAtom-caption")).toHaveCount(0);
  await expect(page.getByTestId("waitingAtom-caption")).toHaveCount(0);
  // The timelines keep when each await resolved, timed from the refresh.
  await expect(plainAwait).toHaveText([
    /^resolved with Loaded 1 time at \d+ ms$/u,
    /^resolved with Loaded 2 times at \d+ ms$/u,
  ]);
  await expect(heldAwait).toHaveText([
    /^resolved with Loaded 2 times at \d+ ms$/u,
  ]);
  expect(await dotTime(plainAwait.nth(0))).toBeLessThan(1000);
  expect(await dotTime(heldAwait.nth(0))).toBeGreaterThan(1500);

  // A failure: the failed snippet takes over, and Try again starts the boundary afresh.
  const weather = page.getByTestId("weather");
  await expect(weather).toHaveText("18 °C, cloudy");
  const failNext = page.getByRole("button", {
    exact: true,
    name: "Fail the next load",
  });
  await setPressed(failNext, true);
  await page.getByRole("button", { exact: true, name: "Reload" }).click();
  await expect(page.getByTestId("weather-failed")).toHaveText(
    "No weather for Paris right now"
  );
  await expect(weather).toHaveCount(0);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(failNext).toHaveAttribute("aria-pressed", "false");
  await expect(weather).toHaveText("18 °C, cloudy");
  await expect(page.getByTestId("weather-failed")).toHaveCount(0);
});

test.describe("Mutations page", () => {
  test("adding a todo shows pending, then the new todo", async ({ page }) => {
    await page.goto("/mutations");
    await page.waitForLoadState("networkidle");
    const state = page.getByTestId("add-state");
    await expect(state).toHaveText("Initial");

    await page.getByTestId("add-draft").fill("Water the plants");
    await page.getByTestId("add-submit").click();
    await expect(page.getByRole("button", { name: "Adding…" })).toBeDisabled();
    await expect(state).toHaveText("Initial, waiting");

    await expect(page.getByTestId("add-created")).toHaveText(
      /^#\d+ Water the plants$/u
    );
    await expect(state).toHaveText("Success");
    await expect(page.getByTestId("add-draft")).toHaveValue("");
  });

  test("a typed failure shows inline and keeps the input", async ({ page }) => {
    await page.goto("/mutations");
    await page.waitForLoadState("networkidle");
    await page
      .getByTestId("add-example")
      .getByRole("button", { name: "Paste a long title" })
      .click();
    const draft = page.getByTestId("add-draft");
    await expect(draft).toHaveValue("x".repeat(70));
    await page.getByTestId("add-submit").click();
    await expect(page.getByTestId("add-error")).toContainText("TitleTooLong");
    await expect(page.getByTestId("add-state")).toHaveText("Failure");
    await expect(draft).toHaveValue("x".repeat(70));
  });

  test("a successful add refreshes the list through its key, a failed one doesn't", async ({
    page,
  }) => {
    // The demo API runs without latency in e2e; hold the request here instead.
    const held = Promise.withResolvers<undefined>();
    await page.route("**/api/rpc{,/}", async (route) => {
      if (route.request().postData()?.includes('"tag":"createTodo"')) {
        await held.promise;
      }
      await route.continue();
    });
    await page.goto("/mutations");
    await page.waitForLoadState("networkidle");
    const example = page.getByTestId("refresh-example");
    const todos = page.getByTestId("refresh-todos").getByRole("listitem");
    const log = page.getByTestId("invalidation-log").getByRole("listitem");
    await expect(todos).toHaveText([
      "Read the Effect Atom source",
      "Write a Svelte adapter",
    ]);

    await page.getByTestId("refresh-draft").fill("Water the plants");
    await page.getByTestId("refresh-submit").click();
    await expect(page.getByTestId("part-create")).toHaveAttribute(
      "data-tone",
      "running"
    );
    await expect(todos).toHaveCount(2);

    held.resolve(undefined);
    await expect(todos).toHaveText([
      "Read the Effect Atom source",
      "Write a Svelte adapter",
      "Water the plants",
    ]);
    await expect(page.getByLabel("key invalidated")).toHaveText("1");
    await expect(page.getByLabel("todosAtom todos")).toHaveText("3");
    await expect(log.filter({ hasText: "createTodo sent" })).toHaveCount(1);
    await expect(
      log.filter({ hasText: 'createTodo succeeded: "todos" invalidated' })
    ).toHaveCount(1);
    await expect(log.filter({ hasText: "listTodos runs again" })).toHaveCount(
      1
    );
    await expect(log.filter({ hasText: "listTodos: 3 todos" })).toHaveCount(1);

    // A failed call invalidates nothing, so the list stays as it is.
    await example.getByRole("button", { name: "Paste a long title" }).click();
    await page.getByTestId("refresh-submit").click();
    await expect(
      log.filter({ hasText: "createTodo failed: nothing invalidated" })
    ).toHaveCount(1);
    await expect(page.getByLabel("key invalidated")).toHaveText("1");
    await expect(todos).toHaveCount(3);

    // Only an added todo has a Remove button.
    const remove = example.getByRole("button", { name: /^Remove /u });
    await expect(remove).toHaveCount(1);
    await remove.click();
    await expect(todos).toHaveText([
      "Read the Effect Atom source",
      "Write a Svelte adapter",
    ]);
  });

  test("each mode gives back something else, and Cancel and Reset work", async ({
    page,
  }) => {
    await page.goto("/mutations");
    await page.waitForLoadState("networkidle");
    const example = page.getByTestId("modes-example");
    const state = page.getByTestId("modes-state");
    const results = (mode: "exit" | "promise" | "value") =>
      page.getByTestId(`modes-${mode}`).getByRole("listitem");
    // The columns, in order: save(n), await savePromise(n), await saveExit(n).
    const call = (column: number) =>
      example.getByRole("button", { exact: true, name: "Call" }).nth(column);
    const callTwice = (column: number) =>
      example
        .getByRole("button", { exact: true, name: "Call twice" })
        .nth(column);
    await expect(state).toHaveText("Initial");
    await expect(results("promise")).toHaveText(["Not called yet."]);

    // The second call interrupts the first, so both promises settle with draft 2.
    await callTwice(1).click();
    await expect(state).toHaveText("Initial, waiting");
    await expect(results("promise")).toHaveText([
      '#1: resolved "draft 2"',
      '#2: resolved "draft 2"',
    ]);
    await expect(state).toHaveText("Success");

    // Value mode returns at once; the atom's state shows the rest.
    await call(0).click();
    await expect(results("value")).toHaveText(["#3: returned undefined"]);
    await expect(state).toHaveText("Success, waiting");
    await expect(state).toHaveText("Success");

    await callTwice(2).click();
    await expect(results("exit")).toHaveText([
      '#4: Exit.Success("draft 5")',
      '#5: Exit.Success("draft 5")',
    ]);
    await expect(state).toHaveText("Success");

    await setPressed(
      example.getByRole("button", { exact: true, name: "Fail the save" }),
      true
    );
    await call(1).click();
    await expect(results("promise").nth(2)).toHaveText(
      "#6: rejected, DiskFull"
    );
    await expect(state).toHaveText("Failure");

    await call(2).click();
    await expect(state).toHaveText("Failure, waiting");
    const cancel = example.getByRole("button", { exact: true, name: "Cancel" });
    await cancel.click();
    await expect(results("exit").nth(2)).toHaveText(
      "#7: Exit.Failure, interrupted"
    );
    await expect(state).toHaveText("Failure, interrupted");
    await expect(cancel).toBeDisabled();

    await example.getByRole("button", { exact: true, name: "Reset" }).click();
    await expect(state).toHaveText("Initial");
  });

  test("an optimistic toggle shows at once, and rolls back when the save fails", async ({
    page,
  }) => {
    // Hold the real toggle so the provisional value is all the page can show.
    const held = Promise.withResolvers<undefined>();
    await page.route("**/api/rpc{,/}", async (route) => {
      if (route.request().postData()?.includes('"tag":"toggleTodo"')) {
        await held.promise;
      }
      await route.continue();
    });
    await page.goto("/mutations");
    await page.waitForLoadState("networkidle");
    const example = page.getByTestId("optimistic-example");
    const list = page.getByTestId("optimistic-todos");
    const server = page.getByTestId("server-todos").getByRole("listitem");
    const provisional = list
      .getByRole("listitem")
      .filter({ hasText: "provisional" });
    const state = page.getByTestId("optimistic-state");
    const first = list.getByRole("checkbox", {
      name: "Read the Effect Atom source",
    });
    await expect(first).not.toBeChecked();
    await expect(server).toHaveText([
      "○ Read the Effect Atom source",
      "✓ Write a Svelte adapter",
    ]);

    // The screen changes at once; the server keeps the old value until the save lands.
    await first.click();
    await expect(first).toBeChecked();
    await expect(provisional).toHaveCount(1);
    await expect(provisional).toContainText("Read the Effect Atom source");
    await expect(state).toHaveText("Initial, waiting");
    await expect(server.first()).toHaveText("○ Read the Effect Atom source");
    held.resolve(undefined);
    await expect(state).toHaveText("Success");
    await expect(server.first()).toHaveText("✓ Read the Effect Atom source");
    await expect(provisional).toHaveCount(0);
    await expect(first).toBeChecked();

    const failNext = example.getByRole("button", {
      exact: true,
      name: "Make the next save fail",
    });
    await setPressed(failNext, true);
    const second = list.getByRole("checkbox", {
      name: "Write a Svelte adapter",
    });
    await expect(second).toBeChecked();
    await second.click();
    // The provisional value first, then the rollback a moment later.
    await expect(second).not.toBeChecked();
    await expect(provisional).toContainText("Write a Svelte adapter");
    await expect(page.getByTestId("optimistic-error")).toContainText(
      "ConnectionLost"
    );
    await expect(failNext).toHaveAttribute("aria-pressed", "false");
    await expect(second).toBeChecked();
    await expect(provisional).toHaveCount(0);
    await expect(server).toHaveText([
      "✓ Read the Effect Atom source",
      "✓ Write a Svelte adapter",
    ]);
    await expect(first).toBeChecked();
    await expect(state).toHaveText("Failure");
  });
});

test("streams: a stream atom ticks, and a pull atom loads page by page", async ({
  page,
}) => {
  await page.goto("/streams");
  const clockA = page.getByTestId("clock-A");
  const clockB = page.getByTestId("clock-B");
  const readers = page.getByRole("button", { name: "Read clockAtom" });
  const log = page.getByTestId("clock-log").getByRole("listitem");
  const started = log.filter({ hasText: "stream started" });
  const stopped = log.filter({ hasText: "stream stopped" });
  // The stream counts the seconds since it started, from 1.
  await expect(clockA).toHaveText(/^[1-9]/u, { timeout: 3000 });
  // A stream that is still running is a Success that is waiting.
  await expect(page.getByTestId("clock-A-state")).toHaveText(
    "Success, waiting"
  );
  await expect(started).toHaveCount(1);

  // A second reader shares the same stream, so it shows the same count.
  await setPressed(readers.nth(1), true);
  await expect(clockB).toHaveText(/^[1-9]/u, { timeout: 3000 });
  await expect
    .poll(
      async () => (await clockA.textContent()) === (await clockB.textContent())
    )
    .toBe(true);
  await expect(started).toHaveCount(1);

  // Without reader A the stream keeps running for B.
  await setPressed(readers.nth(0), false);
  await expect(clockA).toHaveCount(0);
  const count = (await clockB.textContent()) ?? "";
  await expect(clockB).not.toHaveText(count, { timeout: 3000 });
  await expect(stopped).toHaveCount(0);

  // With no reader the stream stops; a new reader starts it again from the beginning.
  await setPressed(readers.nth(1), false);
  await expect(stopped).toHaveCount(1);
  await setPressed(readers.nth(0), true);
  await expect(clockA).toHaveText(/^(?:starting|1)$/u);
  await expect(started).toHaveCount(2);

  // Each pull brings one chunk, a page of up to three.
  const fruit = page.getByTestId("fruit");
  const chunks = fruit.getByRole("listitem");
  const items = fruit.locator("output");
  const pulls = page.getByRole("list", { name: "Pulls" }).getByRole("listitem");
  await expect(items).toHaveText(["apple", "banana", "cherry"]);
  await expect(chunks).toHaveCount(1);
  await expect(chunks.nth(0)).toContainText("pull 1");
  await expect(page.getByTestId("fruit-done")).toHaveText("false");
  const more = page.getByRole("button", { name: "Load more" });
  await more.click();
  await expect(chunks).toHaveCount(2);
  await expect(chunks.nth(1)).toContainText("pull 2");
  await expect(chunks.nth(1).locator("output")).toHaveText([
    "damson",
    "elderberry",
    "fig",
  ]);
  await more.click();
  await expect(chunks.nth(2).locator("output")).toHaveText(["grape"]);
  await expect(items).toHaveCount(7);
  await expect(page.getByTestId("fruit-done")).toHaveText("false");
  // The pull atom learns the stream has ended only on the next pull, which brings no items.
  await more.click();
  await expect(
    page.getByRole("button", { name: "No more fruit" })
  ).toBeDisabled();
  await expect(page.getByTestId("fruit-done")).toHaveText("true");
  await expect(chunks).toHaveCount(4);
  await expect(chunks.nth(3)).toContainText("nothing: done");
  await expect(items).toHaveCount(7);
  // Each pull adds a chunk, and the last adds none. The pulls that wait for a page show it;
  // the last one may settle too quickly for its waiting state to show.
  await expect(pulls.last()).toHaveText(
    /^\d+ ms\s*Success 7 items, done: true$/u
  );
  const pullTexts = await pulls.allTextContents();
  const settled = pullTexts
    .map((text) => text.replace(/^\s*\d+ ms\s*/u, "").trim())
    .filter((text) => !text.endsWith("waiting"));
  expect(settled.slice(-4)).toEqual([
    "Success 3 items, done: false",
    "Success 6 items, done: false",
    "Success 7 items, done: false",
    "Success 7 items, done: true",
  ]);

  // With disableAccumulation, items holds only the latest page, and the end is a failure.
  await setPressed(
    page.getByRole("button", { name: "disableAccumulation: true" }),
    true
  );
  await expect(items).toHaveText(["apple", "banana", "cherry"]);
  await more.click();
  await expect(items).toHaveText(["damson", "elderberry", "fig"]);
  await expect(chunks).toHaveCount(1);
  await more.click();
  await expect(items).toHaveText(["grape"]);
  await more.click();
  await expect(
    page.getByRole("button", { name: "No more fruit" })
  ).toBeDisabled();
  await expect(page.getByTestId("fruit-cause")).toContainText(
    "NoSuchElementError"
  );
  await expect(chunks.last()).toContainText("nothing: NoSuchElementError");
  await expect(items).toHaveText(["grape"]);
});

test("AtomRef: each field edits a slice, and the card reads the whole", async ({
  page,
}) => {
  await page.goto("/refs");
  await page.waitForLoadState("networkidle");
  const card = page.getByTestId("profile-card");
  await page
    .getByRole("textbox", { name: "Name" })
    .first()
    .fill("Grace Hopper");
  await page.getByRole("textbox", { name: "City" }).fill("New York");
  await expect(card).toContainText("Grace Hopper");
  await expect(card).toContainText("Engineer · New York");
  // The nested slice wrote a new address into the profile.
  await expect(page.getByTestId("profile-value")).toContainText(
    '"city": "New York"'
  );
});

test("AtomRef: an autosave stops when the server's copy equals the draft", async ({
  page,
}) => {
  await page.goto("/refs");
  await page.waitForLoadState("networkidle");
  const requests = page
    .getByRole("list", { name: "Requests" })
    .getByRole("listitem");
  // The editor example above has its own Name field.
  const name = page.getByRole("textbox", { name: "Name" }).last();
  await name.fill("Ada Byron");
  await expect(requests).toHaveText([/"Ada Byron", "Engineer"\s*saved/u]);
  // The answer equals the draft, so setting it saves nothing more.
  await page.waitForTimeout(1500);
  await expect(requests).toHaveCount(1);
  // A tidied answer is a change: it saves once more, then stops.
  await name.fill("grace hopper");
  await expect(requests).toHaveText([
    /"Ada Byron"/u,
    /"grace hopper", "Engineer"\s*saved, tidied/u,
    /"Grace Hopper", "Engineer"\s*saved/u,
  ]);
  await expect(name).toHaveValue("Grace Hopper");
  await page.waitForTimeout(1500);
  await expect(requests).toHaveCount(3);
});

test("scoped atoms: each provider has its own atom", async ({ page }) => {
  await page.goto("/scoped-atoms");
  await page.waitForLoadState("networkidle");
  const count = (name: string) =>
    page.getByLabel(`${name} count`, { exact: true });
  await page.getByRole("button", { name: "Left, first: add one" }).click();
  // Both counters below the left provider share its atom.
  await expect(count("Left, first")).toHaveText("1");
  await expect(count("Left, second")).toHaveText("1");
  await expect(count("Right, first")).toHaveText("100");
  await expect(count("Right, second")).toHaveText("100");
  await page.getByRole("button", { name: "Right, second: add one" }).click();
  await expect(count("Right, first")).toHaveText("101");
  await expect(count("Right, second")).toHaveText("101");
  await expect(count("Left, first")).toHaveText("1");
  await expect(count("Left, second")).toHaveText("1");
});

test("browser atoms: localStorage kvs survives a reload, the server renders its default", async ({
  page,
}) => {
  const { errors } = watch(page);
  await page.goto("/browser");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("draft").fill("hello");
  await expect(page.getByTestId("draft-saved")).toHaveText("hello");
  // The example's own Reload button reloads the whole page.
  const reloaded = page.waitForEvent("load");
  await page.getByRole("button", { name: "Reload the page" }).first().click();
  await reloaded;
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("draft")).toHaveValue("hello");
  await expect(page.getByTestId("draft-saved")).toHaveText("hello");

  // The server cannot read localStorage, so it renders the default and the browser fills it in.
  const html = await serverHtml(page, "/browser");
  expect(html).toContain('data-testid="draft-saved"></output>');
  expect(await errors()).toEqual([]);
});

test("browser atoms: a cookie-backed theme is right in the server's markup", async ({
  page,
}) => {
  const { errors } = watch(page);
  await page.goto("/browser");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("theme").selectOption("dark");

  const html = await serverHtml(page, "/browser");
  expect(html).toContain('data-theme="dark"');

  const reloaded = page.waitForEvent("load");
  await page
    .getByTestId("themed")
    .getByRole("button", { name: "Reload the page" })
    .click();
  await reloaded;
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("theme")).toHaveValue("dark");
  await expect(page.getByTestId("themed")).toContainText(
    "The dark theme, read from the pref-theme cookie."
  );
  await expect(page.getByTestId("themed")).toHaveAttribute(
    "data-theme",
    "dark"
  );
  expect(await errors()).toEqual([]);
});

test("browser atoms: refreshOnWindowFocus computes again when the tab is shown", async ({
  page,
}) => {
  const html = await serverHtml(page, "/browser");
  expect(html).toContain('data-testid="last-seen">not yet</output>');
  await page.goto("/browser");
  await page.waitForLoadState("networkidle");
  const lastSeen = page.getByTestId("last-seen");
  await expect(lastSeen).not.toHaveText("not yet");
  const first = await lastSeen.textContent();
  // The time has a one-second resolution.
  await page.waitForTimeout(1100);
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }))
  );
  await expect(lastSeen).not.toHaveText(first ?? "");
});

test("lifetimes: an atom is disposed when its last reader goes, unless it is kept", async ({
  page,
}) => {
  await page.goto("/lifetimes");
  await page.waitForLoadState("networkidle");
  const log = page.getByTestId("lifetimes-log");
  const entries = page
    .getByRole("list", { name: "Registry" })
    .getByRole("listitem");
  const button = (name: string) =>
    page.getByRole("button", { exact: true, name });
  const readers = (name: string) =>
    page.getByLabel(`${name} readers`, { exact: true });
  const status = (name: string) => page.getByTestId(`lifetimes-${name}-status`);

  await expect(status("plain")).toHaveText("not computed yet");
  await button("plain: add a reader").click();
  await button("plain: add a reader").click();
  await expect(readers("plain")).toHaveText("2");
  await expect(page.getByText("Reading plain")).toHaveCount(2);
  await expect(status("plain")).toHaveText("mounted");
  // Two readers share one computation.
  await expect(entries).toHaveText([/^\d+ ms\s*plain: computed$/u]);
  // One reader is left, so the atom stays.
  await button("plain: remove a reader").click();
  await expect(readers("plain")).toHaveText("1");
  await page.waitForTimeout(300);
  await expect(log).not.toContainText("plain: disposed");
  await button("plain: remove a reader").click();
  await expect(readers("plain")).toHaveText("0");
  await expect(status("plain")).toHaveText("disposed");
  await expect(entries).toHaveText([
    /^\d+ ms\s*plain: computed$/u,
    /^\d+ ms\s*plain: disposed$/u,
  ]);

  await button("keepAlive: add a reader").click();
  await expect(log).toContainText("keepAlive: computed");
  await button("keepAlive: remove a reader").click();
  await page.waitForTimeout(500);
  await expect(status("keepAlive")).toHaveText("no readers, kept alive");
  await expect(log).not.toContainText("keepAlive: disposed");

  // An idle TTL keeps the atom for three seconds after its reader goes.
  await button("idle TTL: add a reader").click();
  await expect(log).toContainText("idle TTL: computed");
  await button("idle TTL: remove a reader").click();
  await page.waitForTimeout(1000);
  await expect(status("idle TTL")).toContainText(/no readers for \d\.\d s/u);
  await expect(log).not.toContainText("idle TTL: disposed");
  await expect(log).toContainText("idle TTL: disposed", { timeout: 5000 });
  await expect(status("idle TTL")).toContainText("disposed");
});
