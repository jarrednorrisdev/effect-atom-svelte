import { expect, test } from "./servers.ts";
import { setPressed } from "./toggle.ts";

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

  test("debounced search: the search follows the debounced query", async ({
    page,
  }) => {
    await page.goto("/cookbook");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("search").fill("str");
    await expect(page.getByTestId("debounced")).toHaveText("str");
    await expect(page.getByTestId("search-results").locator("li")).toHaveText([
      "Stream",
    ]);
    await expect(page.getByTestId("search-state")).toHaveText("Success");
  });

  test("debounced search: quick key presses run one search", async ({
    page,
  }) => {
    // A loaded machine has taken over a second to type these three keys, so the 400 ms debounce
    // fired between them. The page's clock is paused while typing, then let run.
    await page.clock.install();
    await page.goto("/cookbook");
    await page.waitForLoadState("networkidle");
    // The page's clock follows the real one until paused, so a second ahead is never in its past.
    await page.clock.pauseAt(Date.now() + 1000);
    await page.getByTestId("search").pressSequentially("sch", { delay: 50 });
    await expect(page.getByTestId("search-keys")).toHaveText("3");
    await page.clock.resume();
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

  test("server-sent events: messages arrive while connected, and Disconnect closes the connection", async ({
    page,
  }) => {
    await page.goto("/cookbook");
    await page.waitForLoadState("networkidle");
    const closed: string[] = [];
    page.on("requestfailed", (request) => {
      if (request.url().endsWith("/api/events")) {
        closed.push(request.url());
      }
    });
    const messages = page.getByTestId("socket-messages").locator("li");
    const connect = page.getByRole("button", { name: "Connect" });
    await expect(page.getByTestId("socket-closed")).toBeVisible();

    await connect.click();
    await expect(messages.first()).toHaveText("Message 1");
    // Firefox sometimes delivers several messages at once, and the list keeps the last five, so
    // check that they arrive in order rather than where each one lands.
    await expect.poll(() => messages.count()).toBeGreaterThanOrEqual(2);
    const texts = await messages.allTextContents();
    const numbers = texts.map((text) => Number(text.replace("Message ", "")));
    expect(numbers).toEqual(
      numbers.map((_, index) => (numbers[0] ?? 0) + index)
    );
    await expect(page.getByTestId("socket-count")).not.toHaveText("0");

    await page.getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByTestId("socket-closed")).toBeVisible();
    // The registry stops the stream once nothing reads it, and the release closes the
    // EventSource.
    await expect.poll(() => closed.length).toBe(1);

    // A new connection counts from 1 again.
    await connect.click();
    await expect(messages.first()).toHaveText("Message 1");
  });

  test("auth headers: a 401 without the token, then transformClient adds it", async ({
    page,
  }) => {
    await page.goto("/cookbook");
    await page.waitForLoadState("networkidle");
    const send = page.getByRole("button", { name: "GET /api/me" });
    const state = page.getByTestId("auth-state");
    const result = page.getByTestId("auth-result");
    await expect(state).toHaveText("Initial");
    await expect(page.getByTestId("auth-header")).toHaveText("No header");

    const first = page.waitForRequest("**/api/me");
    await send.click();
    const without = await first;
    expect(without.headers().authorization).toBeUndefined();
    await expect(state).toHaveText("Failure");
    await expect(result).toHaveText(
      "This route needs an Authorization header."
    );

    await setPressed(
      page.getByRole("button", { exact: true, name: "Signed in" }),
      true
    );
    await expect(page.getByTestId("auth-header")).toHaveText(
      "Authorization: Bearer demo-token"
    );
    const second = page.waitForRequest("**/api/me");
    await send.click();
    const withToken = await second;
    expect(withToken.headers().authorization).toBe("Bearer demo-token");
    await expect(state).toHaveText("Success");
    await expect(result).toHaveText("Signed in as Ada");
    const history = page.getByTestId("auth-history").getByRole("listitem");
    await expect(history.filter({ hasText: "Failure" })).not.toHaveCount(0);
    await expect(history.last()).toContainText("Success Ada");
  });

  test("outside components: a .svelte.ts class saves a todo with its hooks", async ({
    page,
  }) => {
    await page.goto("/cookbook");
    await page.waitForLoadState("networkidle");
    const count = page.getByTestId("class-count");
    await expect(count).toHaveText("2");
    await page.getByTestId("class-title").fill("Saved by a class");
    await page
      .getByRole("button", { exact: true, name: "Save" })
      .first()
      .click();
    await expect(page.getByTestId("class-state")).toHaveText("Success");
    await expect(count).toHaveText("3");
    await expect(page.getByTestId("class-title")).toHaveValue("");
    // The mutation invalidated "todos", so the other recipes' lists have it too.
    await expect(page.getByTestId("load-live-count")).toHaveText("3");
  });

  test("outside components: a plain function writes through the registry", async ({
    page,
  }) => {
    await page.goto("/cookbook");
    await page.waitForLoadState("networkidle");
    const draft = page.getByTestId("registry-draft");
    const history = page.getByTestId("registry-history").locator("li");
    await draft.fill("First draft");
    await draft.press("Enter");
    await expect(history).toHaveText(["First draft"]);
    await expect(draft).toHaveValue("");
    await draft.fill("Second draft");
    await draft.press("Enter");
    await expect(history).toHaveText(["First draft", "Second draft"]);
    await expect(page.getByTestId("registry-count")).toHaveText("2");
  });

  test("outside components: load's count is rendered once, todosAtom's follows", async ({
    page,
    request,
  }) => {
    const response = await request.get("/cookbook");
    const html = await response.text();
    expect(html).toMatch(/data-testid="load-count"[^>]*>2</u);

    await page.goto("/cookbook");
    await page.waitForLoadState("networkidle");
    const loaded = page.getByTestId("load-count");
    const live = page.getByTestId("load-live-count");
    await expect(loaded).toHaveText("2");
    await expect(live).toHaveText("2");
    await page.getByTestId("class-title").fill("One more");
    await page
      .getByRole("button", { exact: true, name: "Save" })
      .first()
      .click();
    await expect(live).toHaveText("3");
    await expect(loaded).toHaveText("2");
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
