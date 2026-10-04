import { expect, test } from "./servers.ts";

test.describe("Cookbook page", () => {
  test("dependent queries: the next open todo follows the list", async ({
    page,
  }) => {
    await page.goto("/cookbook");
    await page.waitForLoadState("networkidle");
    const firstOpen = page.getByTestId("first-open");
    // The demo store starts with todo 1 open and todo 2 done.
    await expect(firstOpen).toContainText("Read the Effect Atom source");
    await firstOpen.getByRole("button", { name: "Done" }).click();
    await expect(firstOpen).toHaveText("Nothing left to do.");
  });

  test("infinite scroll: scrolling to the end pulls the next page", async ({
    page,
  }) => {
    await page.goto("/cookbook");
    await page.waitForLoadState("networkidle");
    const feed = page.getByTestId("feed");
    await expect(feed).toContainText("Entry 10");
    await expect(feed).not.toContainText("Entry 11");
    for (const last of [20, 30, 40, 50]) {
      await feed.evaluate((list) => list.scrollTo(0, list.scrollHeight));
      await expect(feed).toContainText(`Entry ${last}`);
    }
    await feed.evaluate((list) => list.scrollTo(0, list.scrollHeight));
    await expect(feed).toContainText("That's everything.");
    await expect(feed.locator("li")).toHaveCount(51);
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
    await expect(list.locator("li")).toHaveCount(2);

    await page.getByTestId("new-todo").fill("Cook something");
    await page.getByTestId("new-todo-add").click();
    await expect(list).toContainText("Cook something (saving…)");
    await expect(page.getByTestId("new-todo-add")).toBeDisabled();
    held.resolve(undefined);
    await expect(list.locator("li").last()).toHaveText("Cook something");

    await page.getByTestId("new-todo").fill("z".repeat(80));
    await page.getByTestId("new-todo-add").click();
    await expect(page.getByTestId("new-todo-error")).toHaveText(
      "Keep it to 60 characters."
    );
    await expect(list.locator("li")).toHaveCount(3);
    await expect(list).not.toContainText("zzz");
  });

  test("polling: the list is fetched again on a timer", async ({ page }) => {
    await page.goto("/cookbook");
    const polled = page.getByTestId("polled");
    await expect(polled).toContainText("2 todos, checked at");
    const first = await polled.textContent();
    // The time has a one-second resolution, and the poll runs every three seconds.
    await expect(polled).not.toHaveText(first ?? "", { timeout: 5000 });
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
  });
});
