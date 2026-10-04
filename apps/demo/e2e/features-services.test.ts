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
