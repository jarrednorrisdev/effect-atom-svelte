import { expect, test } from "./servers.ts";

// The examples JND-82 added to the Atoms pages, one for each feature section that had none.

test.describe("Atoms pages: an example for every feature", () => {
  test("reading and writing: useAtomSubscribe calls back on every change", async ({
    page,
  }) => {
    await page.goto("/reading-and-writing");
    await page.waitForLoadState("networkidle");
    const saves = page
      .getByRole("list", { name: "Saves" })
      .getByRole("listitem");
    // immediate calls it once with the current value.
    await expect(saves).toHaveText([/^\d+ ms\s*saved ""$/u]);
    await page.getByTestId("note").pressSequentially("hi");
    await expect(saves).toHaveText([
      /saved ""$/u,
      /saved "h"$/u,
      /saved "hi"$/u,
    ]);
    await page.getByRole("button", { exact: true, name: "Clear" }).click();
    await expect(saves.last()).toHaveText(/saved ""$/u);
    await expect(saves).toHaveCount(4);
  });

  test("reading and writing: a getter moves the hook to another atom", async ({
    page,
  }) => {
    await page.goto("/reading-and-writing");
    await page.waitForLoadState("networkidle");
    const followed = page.getByTestId("followed");
    await expect(followed).toHaveValue("Half a thought");
    await followed.fill("Draft text");
    await expect(page.getByTestId("draft")).toHaveText("Draft text");
    await expect(page.getByTestId("saved")).toHaveText("Published post");
    await page.getByLabel("Follow savedAtom").check();
    await expect(followed).toHaveValue("Published post");
    await followed.fill("New post");
    await expect(page.getByTestId("saved")).toHaveText("New post");
    // draftAtom kept its value.
    await expect(page.getByTestId("draft")).toHaveText("Draft text");
    await page.getByLabel("Follow savedAtom").uncheck();
    await expect(followed).toHaveValue("Draft text");
  });
});
