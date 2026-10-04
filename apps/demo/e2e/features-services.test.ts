import { expect, test } from "./servers.ts";

test.describe("Errors page", () => {
  test("one failing atom read three ways: a result, a boundary and includeFailure", async ({
    page,
  }) => {
    await page.goto("/errors");
    await page.waitForLoadState("networkidle");
    const boundary = page.getByTestId("places-boundary");
    const inPlace = page.getByTestId("places-in-place");
    await expect(page.getByTestId("places-result")).toHaveText(
      "Write the docs"
    );
    await expect(boundary).toHaveText("Write the docs");
    await expect(inPlace).toHaveText("Write the docs");

    await page.getByTestId("places-id").selectOption("7");
    await expect(page.getByTestId("places-result-state")).toHaveText("Failure");
    await expect(page.getByTestId("places-result")).toHaveText(
      "NotFound { id: 7 }"
    );
    // The handleError hook keeps the tag and message, not the error's id.
    await expect(boundary).toHaveText("NotFound: There is no todo 7");
    const received = await page.getByTestId("places-received").textContent();
    expect(JSON.parse(received ?? "")).toEqual({
      message: "There is no todo 7",
      status: 500,
      tag: "NotFound",
    });
    await expect(inPlace).toHaveText("NotFound { id: 7 }");

    // The boundary stays failed until it is reset; the others follow the atom.
    await page.getByTestId("places-id").selectOption("2");
    await expect(inPlace).toHaveText("Water the plants");
    await expect(page.getByTestId("places-result")).toHaveText(
      "Water the plants"
    );
    await expect(boundary).toHaveText("NotFound: There is no todo 7");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(boundary).toHaveText("Water the plants");
  });

  test("recovering inside the effect turns NotFound into null", async ({
    page,
  }) => {
    await page.goto("/errors");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("recover-plain-state")).toHaveText("Failure");
    await expect(page.getByTestId("recover-caught-state")).toHaveText(
      "Success"
    );
    await expect(page.getByTestId("recover-caught")).toHaveText(
      "null: no todo yet, and nothing to handle."
    );
    await page.getByTestId("recover-id").selectOption("1");
    await expect(page.getByTestId("recover-plain")).toHaveText(
      "Write the docs"
    );
    await expect(page.getByTestId("recover-caught")).toHaveText(
      "Write the docs"
    );
    await expect(page.getByTestId("recover-plain-state")).toHaveText("Success");
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
  await expect(result).toHaveText("TitleTooLong: the effect stopped there");
  await expect(page.getByTestId("create-read-state")).toHaveText("Failure");
  await expect(calls).toHaveText([/createTodo sent$/u]);
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
  await expect(page.getByTestId("signed-todo")).toHaveText(
    "Failed with TodoNotFound"
  );
  await expect(page.getByTestId("signed-state")).toHaveText("Failure");
  await expect(log).toHaveText([
    /GET \/api\/todos\/1, x-reader: docs$/u,
    /200$/u,
    /GET \/api\/todos\/99, x-reader: docs$/u,
    /404$/u,
  ]);
});
