import { expect, test } from "./servers.ts";

test.describe("Cookbook page", () => {
  test("dependent queries: the next open todo follows the list", async ({
    page,
  }) => {
    // Hold the toggle request to see Done wait for it.
    const held = Promise.withResolvers<undefined>();
    await page.route("**/api/rpc{,/}", async (route) => {
      if (route.request().postData()?.includes('"tag":"toggleTodo"')) {
        await held.promise;
      }
      await route.continue();
    });
    await page.goto("/cookbook");
    await page.waitForLoadState("networkidle");
    const firstOpen = page.getByTestId("first-open");
    const state = page.getByTestId("first-open-state");
    // The demo store starts with todo 1 open and todo 2 done.
    await expect(firstOpen).toHaveText("Next up: Read the Effect Atom source");
    await expect(state).toHaveText("Success");
    const done = page.getByRole("button", { exact: true, name: "Done" });
    await done.click();
    await expect(done).toBeDisabled();
    held.resolve(undefined);
    await expect(firstOpen).toHaveText("Nothing left to do.");
    await expect(state).toHaveText("Success");
    await expect(done).toHaveCount(0);
  });

  test("infinite scroll: scrolling to the end pulls the next page", async ({
    page,
  }) => {
    await page.goto("/cookbook");
    await page.waitForLoadState("networkidle");
    const feed = page.getByTestId("feed");
    const count = page.getByTestId("feed-count");
    await expect(feed).toContainText("Entry 10");
    await expect(feed).not.toContainText("Entry 11");
    await expect(count).toHaveText("10");
    await expect(page.getByTestId("feed-state")).toHaveText("Success");
    for (const last of [20, 30, 40, 50]) {
      await feed.evaluate((list) => list.scrollTo(0, list.scrollHeight));
      await expect(feed).toContainText(`Entry ${last}`);
      await expect(count).toHaveText(String(last));
    }
    await feed.evaluate((list) => list.scrollTo(0, list.scrollHeight));
    await expect(feed).toContainText("That's everything.");
    await expect(feed.locator("li")).toHaveCount(51);
    await expect(page.getByTestId("feed-state")).toHaveText("Success");
  });

  test("form: an optimistic todo, then the saved one, and a typed error rolls back", async ({
    page,
  }) => {
    // The demo API runs without latency in e2e; hold the create request to see the optimistic
    // state.
    const held = Promise.withResolvers<undefined>();
    await page.route("**/api/rpc{,/}", async (route) => {
      if (route.request().postData()?.includes('"tag":"createTodo"')) {
        await held.promise;
      }
      await route.continue();
    });
    await page.goto("/cookbook");
    await page.waitForLoadState("networkidle");
    const list = page.getByTestId("new-todo-list");
    const add = page.getByTestId("new-todo-add");
    const state = page.getByTestId("new-todo-state");
    await expect(list.locator("li")).toHaveCount(2);
    await expect(state).toHaveText("Initial");

    await page.getByTestId("new-todo").fill("Cook something");
    await add.click();
    await expect(list).toContainText("Cook something (saving…)");
    await expect(list.locator("li").last()).toHaveAttribute(
      "aria-busy",
      "true"
    );
    await expect(add).toBeDisabled();
    await expect(add).toHaveText("Adding…");
    await expect(state).toHaveText("Initial, waiting");
    held.resolve(undefined);
    await expect(list.locator("li").last()).toHaveText("Cook something");
    await expect(state).toHaveText("Success");
    await expect(add).toHaveText("Add");
    await expect(page.getByTestId("new-todo")).toHaveValue("");

    await page.getByTestId("new-todo").fill("z".repeat(80));
    await add.click();
    await expect(page.getByTestId("new-todo-error")).toHaveText(
      "Keep it to 60 characters."
    );
    await expect(state).toHaveText("Failure");
    await expect(list.locator("li")).toHaveCount(3);
    await expect(list).not.toContainText("zzz");

    // A good title clears the error.
    await page.getByTestId("new-todo").fill("Short");
    await add.click();
    await expect(page.getByTestId("new-todo-error")).toHaveCount(0);
    await expect(list.locator("li").last()).toHaveText("Short");
  });

  test("polling: the list is fetched again on a timer", async ({ page }) => {
    await page.goto("/cookbook");
    const polled = page.getByTestId("polled");
    await expect(polled).toContainText("2 todos, checked at");
    const first = await polled.textContent();
    // The time has a one-second resolution, and the poll runs every three seconds.
    await expect(polled).not.toHaveText(first ?? "", { timeout: 5000 });
    // Each check shows in the history: waiting while it runs, then the count.
    const checks = page.getByTestId("polled-history").getByRole("listitem");
    await expect(
      checks.filter({ hasText: "Success 2 todos, waiting" })
    ).not.toHaveCount(0);
    await expect(checks.last()).toContainText("Success 2 todos");
    await expect(page.getByTestId("polled-state")).toHaveText("Success");
  });

  test("debounced search: searchParam drives the URL and the search", async ({
    page,
  }) => {
    await page.goto("/cookbook");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("search").fill("str");
    await expect(page).toHaveURL(/\?q=str/u);
    await expect(page.getByTestId("debounced")).toHaveText("str");
    await expect(page.getByTestId("search-results").locator("li")).toHaveText([
      "Stream",
    ]);
    await expect(page.getByTestId("search-state")).toHaveText("Success");
  });

  test("debounced search: quick key presses run one search", async ({
    page,
  }) => {
    await page.goto("/cookbook");
    await page.waitForLoadState("networkidle");
    // Well under the 400 ms debounce between keys.
    await page.getByTestId("search").pressSequentially("sch", { delay: 50 });
    await expect(page.getByTestId("search-keys")).toHaveText("3");
    await expect(page.getByTestId("search-results").locator("li")).toHaveText([
      "Schema",
    ]);
    await expect(page.getByTestId("search-runs")).toHaveText("1");
    await expect(page.getByTestId("debounced")).toHaveText("sch");
    const timeline = page.getByTestId("search-timeline");
    await expect(
      timeline.getByRole("list", { name: "typed" }).getByRole("listitem")
    ).toHaveCount(3);
    await expect(
      timeline.getByRole("list", { name: "debounced" }).getByRole("listitem")
    ).toHaveCount(1);
    await expect(
      timeline.getByRole("list", { name: "search" }).getByRole("listitem")
    ).toHaveText([/search started/u, /1 found/u]);
  });
});

test.describe("Testing page", () => {
  test("the component under test runs on the page", async ({ page }) => {
    await page.goto("/testing");
    await page.waitForLoadState("networkidle");
    const counter = page.getByRole("button", { name: "Count: 0" });
    await counter.click();
    await expect(page.getByRole("button", { name: "Count: 1" })).toBeVisible();
    await expect(page.getByText("Doubled: 2")).toBeVisible();
  });
});
