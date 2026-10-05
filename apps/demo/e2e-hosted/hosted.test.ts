import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { setPressed } from "../e2e/toggle.ts";
import { pages } from "../src/lib/docs/nav.ts";

/** Fails any request for the demo API over the network, and records it. */
const blockNetworkApi = async (page: Page) => {
  const requests: string[] = [];
  await page.route("**/api/**", async (route) => {
    requests.push(route.request().url());
    await route.abort();
  });
  return requests;
};

for (const { href } of pages) {
  test(`${href} loads without errors or network API calls`, async ({
    page,
  }) => {
    const requests = await blockNetworkApi(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(href);
    expect(response?.status()).toBe(200);
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
    expect(requests).toEqual([]);
  });
}

test("RPC: prerendered todos, then add, a typed error, toggle and a stream", async ({
  page,
  request,
}) => {
  const response = await request.get("/rpc");
  const html = await response.text();
  expect(html).toContain("Read the Effect Atom source");

  const requests = await blockNetworkApi(page);
  await page.goto("/rpc");
  await page.waitForLoadState("networkidle");
  const list = page.getByTestId("rpc-todos");
  await expect(list.locator("li")).toHaveCount(2);

  await page.getByTestId("rpc-draft").fill("Added in the tab");
  await page.getByTestId("rpc-add").click();
  await expect(list).toContainText("Added in the tab");

  await page.getByTestId("rpc-draft").fill("x".repeat(80));
  await page.getByTestId("rpc-add").click();
  await expect(page.getByTestId("rpc-error")).toContainText(
    "TitleTooLong { maxLength: 60 }"
  );

  const checkbox = list.locator("li").first().getByRole("checkbox");
  await checkbox.click();
  await expect(checkbox).toBeChecked();

  // One list item per pull, with an <output> for each number it brought; the pull that finds
  // the end brings nothing.
  const ticks = page.getByTestId("ticks");
  const pulls = ticks.getByRole("listitem");
  const pull = page.getByRole("button", { name: "Pull next" });
  await expect(ticks.locator("output").first()).toHaveText("0");
  await expect(async () => {
    if (await pull.isEnabled()) {
      await pull.click();
    }
    await expect(pulls.last()).toContainText("nothing: done", {
      timeout: 500,
    });
  }).toPass();
  await expect(ticks.locator("output")).toHaveText(["0", "1", "2", "3", "4"]);
  expect(requests).toEqual([]);
});

test("HTTP API: prerendered todos, then create, filter and a typed 404", async ({
  page,
  request,
}) => {
  const response = await request.get("/http");
  const html = await response.text();
  expect(html).toContain("Write a Svelte adapter");

  const requests = await blockNetworkApi(page);
  await page.goto("/http");
  await page.waitForLoadState("networkidle");
  const list = page.getByTestId("http-todos");

  await page.getByTestId("http-draft").fill("Added in the tab");
  await page.getByTestId("http-add").click();
  await expect(list).toContainText("Added in the tab");

  await page
    .getByRole("group", { name: "Filter" })
    .getByRole("button", { exact: true, name: "Done" })
    .click();
  await expect(list.locator("li").filter({ hasText: "○" })).toHaveCount(0);
  await expect(list.locator("li").filter({ hasText: "✔" })).not.toHaveCount(0);

  await page.getByTestId("http-id").fill("999");
  await expect(page.getByTestId("http-found")).toHaveText(
    "TodoNotFound: there is no todo 999"
  );
  expect(requests).toEqual([]);
});

test("Mutations: add, a typed error and an optimistic rollback in the tab", async ({
  page,
}) => {
  const requests = await blockNetworkApi(page);
  await page.goto("/mutations");
  await page.waitForLoadState("networkidle");
  const todos = page.getByTestId("refresh-todos").getByRole("listitem");
  await expect(todos).toHaveCount(2);

  await page.getByTestId("refresh-draft").fill("Added in the tab");
  await page.getByTestId("refresh-submit").click();
  await expect(todos).toHaveCount(3);
  await expect(page.getByLabel("key invalidated")).toHaveText("1");

  await page
    .getByTestId("add-example")
    .getByRole("button", { name: "Paste a long title" })
    .click();
  await page.getByTestId("add-submit").click();
  await expect(page.getByTestId("add-error")).toContainText("TitleTooLong");

  const example = page.getByTestId("optimistic-example");
  await setPressed(
    example.getByRole("button", {
      exact: true,
      name: "Make the next save fail",
    }),
    true
  );
  const box = page
    .getByTestId("optimistic-todos")
    .getByRole("checkbox", { name: "Write a Svelte adapter" });
  await box.click();
  await expect(page.getByTestId("optimistic-error")).toBeVisible();
  await expect(box).toBeChecked();
  expect(requests).toEqual([]);
});

test("Cookbook: server-sent events, an auth header and a load function in the tab", async ({
  page,
  request,
}) => {
  // load ran when the page was prerendered, against the API in the build.
  const response = await request.get("/cookbook");
  const html = await response.text();
  expect(html).toMatch(/data-testid="load-count"[^>]*>2</u);

  const requests = await blockNetworkApi(page);
  await page.goto("/cookbook");
  await page.waitForLoadState("networkidle");

  const messages = page.getByTestId("socket-messages").locator("li");
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(messages.nth(1)).toHaveText("Message 2");
  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByTestId("socket-closed")).toBeVisible();

  const send = page.getByRole("button", { name: "GET /api/me" });
  await send.click();
  await expect(page.getByTestId("auth-result")).toHaveText(
    "This route needs an Authorization header."
  );
  await setPressed(
    page.getByRole("button", { exact: true, name: "Signed in" }),
    true
  );
  await send.click();
  await expect(page.getByTestId("auth-result")).toHaveText("Signed in as Ada");
  expect(requests).toEqual([]);
});
