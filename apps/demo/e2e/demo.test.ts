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
    await expect(page.getByTestId("rpc-error")).toContainText("TitleTooLong");

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
    await expect(page.getByTestId("rpc-selected")).toContainText(
      "TodoNotFound"
    );
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
    await expect(page.getByTestId("http-error")).toContainText("TitleTooLong");

    await page.getByTestId("http-id").fill("999");
    await expect(page.getByTestId("http-found")).toContainText("TodoNotFound");
    await page.getByTestId("http-id").fill("1");
    await expect(page.getByTestId("http-found")).toContainText(
      "Read the Effect Atom source"
    );
  });
});

test("first atom: two counters share one atom", async ({ page }) => {
  await page.goto("/first-atom");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "First counter: increment" }).click();
  await page.getByRole("button", { name: "Second counter: increment" }).click();
  await expect(page.locator("[data-example] output")).toHaveText(["2", "2"]);
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

test("suspense: pending, value and failure", async ({ page }) => {
  await page.goto("/suspense");
  await expect(page.getByTestId("suspense-value")).toContainText("loaded");
  await expect(page.getByTestId("suspense-failed")).toHaveText(
    "This atom always fails"
  );
  await expect(page.getByTestId("suspense-failed-tag")).toHaveText(
    "AlwaysFails"
  );
});

test("streams: a stream atom ticks and a streaming RPC pulls to the end", async ({
  page,
}) => {
  await page.goto("/streams");
  await expect(page.getByTestId("clock")).toHaveText(/^[1-9]/u, {
    timeout: 3000,
  });
  const ticks = page.getByTestId("ticks");
  await expect(ticks).toHaveText("0");
  const pull = page.getByRole("button", { name: "Pull next" });
  // HTTP RPC has no acks, so the server streams ahead and a pull takes every item that has
  // arrived since the last one. Each click must add items in order, not exactly one.
  const done = "0, 1, 2, 3, 4 (done)";
  let shown = "0";
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

test("refs and scopes: AtomRef updates and scoped atoms stay separate", async ({
  page,
}) => {
  await page.goto("/refs");
  await page.waitForLoadState("networkidle");
  await page.getByRole("textbox").fill("Grace");
  await expect(page.getByTestId("ref-name")).toHaveText("Grace");
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
  await page.getByLabel("plain").check();
  await expect(log).toContainText("plain: computed");
  await page.getByLabel("plain").uncheck();
  await expect(log).toContainText("plain: disposed");
  await page.getByLabel("keepAlive").check();
  await page.getByLabel("keepAlive").uncheck();
  await page.waitForTimeout(500);
  await expect(log).toContainText("keepAlive: computed");
  await expect(log).not.toContainText("keepAlive: disposed");
});
