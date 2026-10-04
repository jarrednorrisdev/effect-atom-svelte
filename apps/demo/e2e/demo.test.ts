import { setTimeout as delay } from "node:timers/promises";

import type { Page } from "@playwright/test";

import { pages as navPages } from "../src/lib/docs/nav.ts";
import { expect, test } from "./servers.ts";

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
    await page.waitForLoadState("networkidle");

    await page.getByTestId("rpc-draft").fill("Slow todo");
    await page.getByTestId("rpc-add").click();
    await expect(page.getByTestId("rpc-add")).toBeDisabled();
    held.resolve(undefined);
    await expect(page.getByTestId("rpc-add")).toBeEnabled();
    await expect(page.getByTestId("rpc-todos")).toContainText("Slow todo");
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

  test("create refreshes the list, and a typed 404", async ({ page }) => {
    await page.goto("/http");
    await page.waitForLoadState("networkidle");
    const list = page.getByTestId("http-todos");

    await page.getByTestId("http-draft").fill("Added over HTTP");
    await page.getByTestId("http-add").click();
    await expect(list).toContainText("Added over HTTP");
    await page.getByTestId("http-draft").fill("y".repeat(80));
    await page.getByTestId("http-add").click();
    await expect(page.getByTestId("http-error")).toHaveText(
      "TitleTooLong: the limit is 60 characters"
    );

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
  const where = page.getByTestId("computed-on");
  await expect(where).toHaveText("the server");
  // Give a refetch, if there were one, time to land.
  await page.waitForTimeout(600);
  await expect(where).toHaveText("the server");
  await page.getByRole("button", { name: "Compute again" }).click();
  await expect(where).toHaveText("the browser");
});

test("first atom: two counters share one atom", async ({ page }) => {
  await page.goto("/first-atom");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "First counter: increment" }).click();
  await page.getByRole("button", { name: "Second counter: increment" }).click();
  await expect(page.locator("[data-example] output")).toHaveText(["2", "2"]);
  // Nothing reads the atom while the counters are hidden, so it starts again.
  await page.getByRole("button", { name: "Hide counters" }).click();
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
  await page.getByRole("button", { name: "×10 with an updater" }).click();
  await expect(page.getByTestId("count")).toHaveText("20");
  await page.getByTestId("name").fill("Effect");
  await expect(page.getByTestId("greeting")).toHaveText("Hello, Effect!");
});

test("derived atoms: a read-only and a writable derived atom", async ({
  page,
}) => {
  await page.goto("/derived-atoms");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("fahrenheit")).toHaveValue("68");
  await expect(page.getByTestId("feel")).toHaveText("mild");
  await page.getByTestId("celsius").fill("100");
  await expect(page.getByTestId("fahrenheit")).toHaveValue("212");
  await expect(page.getByTestId("feel")).toHaveText("hot");
  // Writing the derived atom writes the atom it reads from.
  await page.getByTestId("fahrenheit").fill("32");
  await expect(page.getByTestId("celsius")).toHaveValue("0");
  await expect(page.getByTestId("feel")).toHaveText("cold");
});

test("families: a getter follows the selected key's atom", async ({ page }) => {
  await page.goto("/families");
  await page.waitForLoadState("networkidle");
  const count = page.getByRole("button", { name: "Count one" });
  await count.click();
  await count.click();
  await page.getByTestId("fruit").selectOption("pears");
  await expect(page.getByTestId("tally")).toHaveText("0");
  await count.click();
  await expect(page.getByTestId("total-apples")).toHaveText("2");
  await expect(page.getByTestId("total-pears")).toHaveText("1");
  await page.getByTestId("fruit").selectOption("apples");
  await expect(page.getByTestId("tally")).toHaveText("2");
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
  await page.getByTestId("hash-algorithm").selectOption("MD5");
  await expect(hash).toHaveText("UnsupportedAlgorithm: Web Crypto has no MD5");
  await page.getByTestId("hash-algorithm").selectOption("SHA-1");
  await expect(hash).toHaveText("a9993e364706816aba3e25717850c26c9cd0d89d");
});

test("errors: typed errors match on _tag, and a defect is told apart", async ({
  page,
}) => {
  await page.goto("/errors");
  await page.waitForLoadState("networkidle");
  const message = page.getByTestId("outcome-message");
  const outcome = page.getByTestId("outcome");
  await expect(message).toHaveText("NotFound: there is no todo 7");
  await outcome.selectOption("forbidden");
  await expect(message).toHaveText("Forbidden: you can't see this todo");
  await outcome.selectOption("defect");
  await expect(message).toHaveText(
    "Something went wrong: Error: todos is undefined"
  );
  await outcome.selectOption("success");
  await expect(message).toHaveText("Write the docs");
});

test("async atoms: initial, success and a refresh that keeps the value", async ({
  page,
}) => {
  await page.goto("/async-atoms");
  await page.waitForLoadState("networkidle");
  const state = page.getByTestId("die-state");
  await expect(state).toHaveText("Success");
  await expect(page.getByTestId("die")).toHaveText(/^[1-6]$/u);
  await page.getByRole("button", { name: "Roll again" }).click();
  // The previous roll stays on screen while the new one runs.
  await expect(state).toHaveText("Success, waiting");
  await expect(page.getByTestId("die")).toHaveText(/^[1-6]$/u);
  await expect(state).toHaveText("Success");
});

test("suspense: pending, value, refresh and failure", async ({ page }) => {
  await page.goto("/suspense");
  const value = page.getByTestId("suspense-value");
  await expect(value).toContainText("Loaded");
  await page.waitForLoadState("networkidle");
  const first = await value.textContent();
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(value).not.toHaveText(first ?? "");
  await expect(page.getByTestId("suspense-failed")).toHaveText(
    "This atom always fails"
  );
  await expect(page.getByTestId("suspense-failed-tag")).toHaveText(
    "AlwaysFails"
  );
});

test("mutations: a second call supersedes the first, and Reset clears it", async ({
  page,
}) => {
  await page.goto("/mutations");
  await page.waitForLoadState("networkidle");
  const state = page.getByTestId("echo-state");
  await expect(state).toHaveText("Initial");
  await page.getByRole("button", { name: 'Echo "first"' }).click();
  await expect(state).toHaveText("Initial, waiting");
  await page.getByRole("button", { name: 'Echo "second"' }).click();
  // Both promises settle with the second call's result.
  const replies = page.getByTestId("echo-replies").locator("li");
  await expect(replies).toHaveCount(2);
  await expect(replies.filter({ hasText: "first → SECOND" })).toHaveCount(1);
  await expect(replies.filter({ hasText: "second → SECOND" })).toHaveCount(1);
  await expect(state).toHaveText("Success");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(state).toHaveText("Initial");
});

test("mutations: reactivity keys refresh the list, optimistic updates show at once", async ({
  page,
}) => {
  await page.goto("/mutations");
  await page.waitForLoadState("networkidle");
  const notes = page.getByTestId("notes").locator("li");
  await expect(notes).toHaveText(["Read the docs"]);

  await page.getByTestId("note").fill("Plain");
  const add = page.getByRole("button", { exact: true, name: "Add" });
  await add.click();
  await expect(add).toBeDisabled();
  await expect(notes).toHaveText(["Read the docs"]);
  await expect(notes).toHaveText(["Read the docs", "Plain"]);

  await page.getByTestId("note").fill("Quick");
  await page.getByRole("button", { name: "Add optimistically" }).click();
  await expect(notes).toHaveText(["Read the docs", "Plain", "Quick (saving…)"]);
  await expect(notes).toHaveText(["Read the docs", "Plain", "Quick"]);
});

test("streams: a stream atom ticks, and a pull atom loads page by page", async ({
  page,
}) => {
  await page.goto("/streams");
  await expect(page.getByTestId("clock")).toHaveText(/^[1-9]/u, {
    timeout: 3000,
  });
  const fruit = page.getByTestId("fruit");
  await expect(fruit).toHaveText("apple, banana, cherry");
  const more = page.getByRole("button", { name: "Load more" });
  await more.click();
  await expect(fruit).toHaveText(
    "apple, banana, cherry, damson, elderberry, fig"
  );
  await more.click();
  await expect(fruit).toHaveText(
    "apple, banana, cherry, damson, elderberry, fig, grape"
  );
  // The pull atom learns the stream has ended only on the next pull, which brings no items.
  await more.click();
  await expect(
    page.getByRole("button", { name: "No more fruit" })
  ).toBeDisabled();
  await expect(fruit).toHaveText(
    "apple, banana, cherry, damson, elderberry, fig, grape"
  );
});

test("AtomRef: a property ref updates the ref and its derived ref", async ({
  page,
}) => {
  await page.goto("/refs");
  await page.waitForLoadState("networkidle");
  await page.getByRole("textbox", { name: "Name" }).fill("Grace");
  await expect(page.getByTestId("ref-name")).toHaveText("Grace");
  await expect(page.getByTestId("ref-badge")).toHaveText("Grace · Engineer");
});

test("scoped atoms: each provider has its own atom", async ({ page }) => {
  await page.goto("/scoped-atoms");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "0" }).first().click();
  await expect(
    page.getByRole("button", { exact: true, name: "1" })
  ).toHaveCount(2);
  await expect(page.getByRole("button", { name: "100" })).toHaveCount(2);
});

test("browser atoms: localStorage kvs survives a reload, the server renders its default", async ({
  page,
}) => {
  const { errors } = watch(page);
  await page.goto("/browser");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("draft").fill("hello");
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("draft")).toHaveValue("hello");

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

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("theme")).toHaveValue("dark");
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

test("browser atoms: searchParam drives the URL", async ({ page }) => {
  await page.goto("/browser");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("search").fill("atoms");
  await expect(page).toHaveURL(/\?q=atoms/u);
  await expect(page.getByTestId("debounced")).toHaveText("atoms");
});

test("lifetimes: plain atoms are disposed on unmount, keepAlive atoms are not", async ({
  page,
}) => {
  await page.goto("/lifetimes");
  await page.waitForLoadState("networkidle");
  const log = page.getByTestId("lifetimes-log");
  await page.getByLabel("plain", { exact: true }).check();
  await expect(log).toContainText("plain: computed");
  await page.getByLabel("plain", { exact: true }).uncheck();
  await expect(log).toContainText("plain: disposed");
  await page.getByLabel("keepAlive", { exact: true }).check();
  await page.getByLabel("keepAlive", { exact: true }).uncheck();
  await page.waitForTimeout(500);
  await expect(log).toContainText("keepAlive: computed");
  await expect(log).not.toContainText("keepAlive: disposed");
  // An idle TTL keeps the atom for three seconds after its reader goes.
  await page.getByLabel("idle TTL", { exact: true }).check();
  await expect(log).toContainText("idle TTL: computed");
  await page.getByLabel("idle TTL", { exact: true }).uncheck();
  await page.waitForTimeout(1000);
  await expect(log).not.toContainText("idle TTL: disposed");
  await expect(log).toContainText("idle TTL: disposed", { timeout: 5000 });
});
