import { expect, test } from "./servers.ts";

test.describe("Errors page", () => {
  test("one failing atom read three ways: a result, a boundary and includeFailure", async ({
    page,
  }) => {
    await page.goto("/errors");
    await page.waitForLoadState("networkidle");
    const example = page
      .locator("[data-example]")
      .filter({ has: page.getByTestId("places-boundary") });
    const pick = (id: number) =>
      example.getByRole("button", { exact: true, name: `Todo ${id}` }).click();
    const boundary = page.getByTestId("places-boundary");
    const inPlace = page.getByTestId("places-in-place");
    await expect(page.getByTestId("places-result")).toHaveText(
      "Write the docs"
    );
    await expect(boundary).toHaveText("Write the docs");
    await expect(inPlace).toHaveText("Write the docs");

    await pick(99);
    await expect(page.getByTestId("places-result-state")).toHaveText("Failure");
    await expect(page.getByTestId("places-result")).toContainText(
      "NotFound { id: 99 }"
    );
    // The handleError hook keeps the tag, not the error's id. NotFound has no message, so
    // SvelteKit's own stays.
    await expect(boundary).toHaveText("NotFound");
    const received = await page.getByTestId("places-received").textContent();
    expect(JSON.parse(received ?? "")).toEqual({
      message: "Internal Error",
      status: 500,
      tag: "NotFound",
    });
    await expect(inPlace).toContainText("NotFound { id: 99 }");

    // The boundary stays failed until it is reset; the others follow the atom.
    await pick(2);
    await expect(inPlace).toHaveText("Water the plants");
    await expect(page.getByTestId("places-result")).toHaveText(
      "Water the plants"
    );
    await expect(boundary).toHaveText("NotFound");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(boundary).toHaveText("Water the plants");
  });
});

test("RPC: one effect creates a todo, then reads it back with the client", async ({
  page,
}) => {
  await page.goto("/rpc");
  await page.waitForLoadState("networkidle");
  const result = page.getByTestId("create-read");
  const calls = page.getByTestId("create-read-log").getByRole("listitem");
  await page.getByTestId("create-read-title").fill("Feed the cat");
  await page.getByRole("button", { name: "Create and read" }).click();
  // The demo store starts with two todos, so the new one is todo 3.
  await expect(result).toHaveText("Todo 3: Feed the cat");
  await expect(page.getByTestId("create-read-state")).toHaveText("Success");
  await expect(calls).toHaveText([
    /createTodo sent$/u,
    /createTodo: todo 3$/u,
    /getTodo sent with id 3$/u,
    /getTodo: "Feed the cat"$/u,
  ]);

  // A failed createTodo ends the effect: getTodo is never sent.
  await page.getByRole("button", { name: "Paste a long title" }).last().click();
  await page.getByRole("button", { name: "Create and read" }).click();
  await expect(result).toContainText("TitleTooLong { maxLength: 60 }");
  await expect(page.getByTestId("create-read-state")).toHaveText("Failure");
  await expect(calls).toHaveText([
    /createTodo sent$/u,
    /createTodo failed: TitleTooLong$/u,
  ]);
  // The effect's type lights up the error member the failure carries.
  await expect(page.locator('[data-member="TitleTooLong"]')).toHaveClass(
    /failed/u
  );
  await expect(page.locator('[data-member="TodoNotFound"]')).not.toHaveClass(
    /failed/u
  );
});

test("HTTP API: transformClient adds a header to every request and sees each status", async ({
  page,
}) => {
  await page.goto("/http");
  await page.waitForLoadState("networkidle");
  const log = page.getByTestId("signed-log").getByRole("listitem");
  const sent = page.waitForRequest("**/api/todos/1");
  await page.getByRole("button", { name: "Get todo 1" }).click();
  const request = await sent;
  expect(request.headers()["x-reader"]).toBe("docs");
  await expect(page.getByTestId("signed-todo")).toHaveText(
    "Read the Effect Atom source"
  );
  await page.getByRole("button", { name: "Get todo 99" }).click();
  // The 404 arrives as the endpoint's typed TodoNotFound, shown as its Cause.
  await expect(page.getByTestId("signed-todo")).toContainText(
    "TodoNotFound { id: 99 }"
  );
  await expect(page.getByTestId("signed-state")).toHaveText("Failure");
  await expect(log).toHaveText([
    /GET \/api\/todos\/1, x-reader: docs$/u,
    /200$/u,
    /GET \/api\/todos\/99, x-reader: docs$/u,
    /404$/u,
  ]);
});

test("browser atoms: searchParam writes the URL once typing stops, and follows Back", async ({
  page,
}) => {
  await page.goto("/browser");
  await page.waitForLoadState("networkidle");
  const filter = page.getByTestId("filter");
  const url = page.getByTestId("filter-url");
  await expect(url).toHaveText("(no query string)");

  // Quick key presses: one write each, and one URL update after the last.
  await filter.pressSequentially("blue");
  await expect(page).toHaveURL(/\/browser\?filter=blue$/u);
  await expect(url).toHaveText("?filter=blue");
  await expect(page.getByTestId("filter-writes")).toHaveText("4");
  await expect(page.getByTestId("filter-updates")).toHaveText("1");

  // An empty value removes the parameter.
  await filter.fill("");
  await expect(page).toHaveURL(/\/browser\?$/u);
  await expect(url).toHaveText("(no query string)");

  // Back restores the URL, and the atom follows it.
  await page.goBack();
  await expect(page).toHaveURL(/\/browser\?filter=blue$/u);
  await expect(filter).toHaveValue("blue");
});

test("browser atoms: searchParam reads the URL in the browser, and an empty string on the server", async ({
  page,
}) => {
  const response = await page.request.get("/browser?filter=red");
  const html = await response.text();
  // The server has no window, so it reads "" whatever the URL says.
  expect(html).toContain('value="" data-testid="filter"');
  expect(html).not.toContain('value="red"');
  await page.goto("/browser?filter=red");
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("filter")).toHaveValue("red");
  await expect(page.getByTestId("filter-url")).toHaveText("?filter=red");
});
