import type { Dialog, Page } from "@playwright/test";

import { expect, test } from "./servers.ts";

/** Records uncaught page errors, so a test can check an example raised none. */
const pageErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
};

/** Opens the Forms page once it has hydrated. */
const openForms = async (page: Page) => {
  await page.goto("/forms");
  await page.waitForLoadState("networkidle");
};

/** Answers every dialog with `accept`, recording each one's type and message. */
const answerDialogs = (page: Page, accept: () => boolean) => {
  const seen: string[] = [];
  page.on("dialog", async (dialog: Dialog) => {
    seen.push(`${dialog.type()}: ${dialog.message()}`);
    await (accept() ? dialog.accept() : dialog.dismiss());
  });
  return seen;
};

/** Leaves the rename form with an unsaved title. */
const editTitle = async (page: Page) => {
  const rename = page.getByTestId("rename");
  await rename.getByLabel("Title of todo 1").fill("Read the Atom source");
  await expect(page.getByTestId("rename-dirty")).toHaveText("Unsaved changes");
};

const confirmMessage = "confirm: Leave without saving the new title?";

test.describe("Forms page", () => {
  test("sign in: an error waits for blur, and a wrong password is the form's error", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await openForms(page);
    const form = page.getByTestId("sign-in");
    const email = form.getByLabel("Email");
    await email.fill("ada");
    await expect(form.getByText("Enter an email address")).toHaveCount(0);
    await email.press("Tab");
    await expect(form.getByText("Enter an email address")).toBeVisible();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await email.fill("ada@example.com");
    await expect(form.getByText("Enter an email address")).toHaveCount(0);
    await form.getByLabel("Password").fill("nope");
    await form.getByRole("button", { name: "Sign in" }).click();
    await expect(form.getByRole("alert")).toHaveText("Wrong email or password");
    await form.getByLabel("Password").fill("atom");
    await form.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByTestId("sign-in-done")).toHaveText(
      "Signed in as ada@example.com"
    );
    expect(errors).toEqual([]);
  });

  test("rename: the server's DuplicateTitle lands on the field, and a save leaves it clean", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await openForms(page);
    const form = page.getByTestId("rename");
    const title = form.getByLabel("Title of todo 1");
    await expect(title).toHaveValue("Read the Effect Atom source");
    await title.fill("Write a Svelte adapter");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(form.getByText("Another todo has that title")).toBeVisible();
    // Editing the field clears the server's error.
    await title.fill("Read the Atom source");
    await expect(form.getByText("Another todo has that title")).toHaveCount(0);
    await form.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("rename-state")).toHaveText("Success");
    await expect(page.getByTestId("rename-dirty")).toHaveText("Saved");
    await expect(form.getByRole("button", { name: "Save" })).toBeDisabled();
    // The query fetched the saved title, and a reload renders it on the server.
    await page.reload();
    await expect(
      page.getByTestId("rename").getByLabel("Title of todo 1")
    ).toHaveValue("Read the Atom source");
    expect(errors).toEqual([]);
  });

  test("order: an item's error moves with it", async ({ page }) => {
    const errors = pageErrors(page);
    await openForms(page);
    const form = page.getByTestId("order");
    const items = form.getByTestId("order-item");
    await form.getByRole("button", { name: "Place order" }).click();
    await expect(items.nth(1)).toContainText("Enter a quantity");
    await expect(form.getByLabel("Quantity of item 2")).toBeFocused();
    await items.nth(1).getByRole("button", { name: "Move to top" }).click();
    await expect(form.getByLabel("Item 1", { exact: true })).toHaveValue("Ink");
    await expect(items.nth(0)).toContainText("Enter a quantity");
    await expect(items.nth(1)).not.toContainText("Enter a quantity");
    await form.getByLabel("Quantity of item 1").fill("3");
    await form.getByRole("button", { name: "Place order" }).click();
    await expect(page.getByTestId("order-placed")).toHaveText(
      "3 × Ink, 2 × Paper, 1 × Stapler"
    );
    expect(errors).toEqual([]);
  });

  test.describe("asking before leaving", () => {
    test("a link: no while clean, a no keeps the page, a yes leaves", async ({
      page,
    }) => {
      let accept = false;
      const dialogs = answerDialogs(page, () => accept);
      await openForms(page);
      await page
        .getByRole("navigation", { name: "Docs" })
        .getByRole("link", { exact: true, name: "Streams" })
        .click();
      await expect(page).toHaveURL(/\/streams$/u);
      expect(dialogs).toEqual([]);
      await openForms(page);
      await editTitle(page);
      await page
        .getByRole("navigation", { name: "Docs" })
        .getByRole("link", { exact: true, name: "Streams" })
        .click();
      await expect.poll(() => dialogs).toEqual([confirmMessage]);
      await expect(page).toHaveURL(/\/forms$/u);
      accept = true;
      await page
        .getByRole("navigation", { name: "Docs" })
        .getByRole("link", { exact: true, name: "Streams" })
        .click();
      await expect(page).toHaveURL(/\/streams$/u);
      // The retried navigation passed without asking again.
      expect(dialogs).toEqual([confirmMessage, confirmMessage]);
    });

    test("back and forward: a no stays on the page, a yes goes back", async ({
      page,
    }) => {
      let accept = false;
      const dialogs = answerDialogs(page, () => accept);
      await page.goto("/mutations");
      await page.waitForLoadState("networkidle");
      await page
        .getByRole("navigation", { name: "Docs" })
        .getByRole("link", { exact: true, name: "Forms" })
        .click();
      await expect(page).toHaveURL(/\/forms$/u);
      await page.waitForLoadState("networkidle");
      await editTitle(page);
      await page.evaluate(() => history.back());
      await expect.poll(() => dialogs).toEqual([confirmMessage]);
      await expect(page).toHaveURL(/\/forms$/u);
      await expect(page.getByTestId("rename-dirty")).toHaveText(
        "Unsaved changes"
      );
      accept = true;
      await page.evaluate(() => history.back());
      await expect(page).toHaveURL(/\/mutations$/u);
      expect(dialogs).toEqual([confirmMessage, confirmMessage]);
    });

    test("an external link asks first, then leaves without the browser asking again", async ({
      page,
    }) => {
      await page.route("https://github.com/**", (route) =>
        route.fulfill({
          body: "<title>GitHub</title>",
          contentType: "text/html",
        })
      );
      let accept = false;
      const dialogs = answerDialogs(page, () => accept);
      await openForms(page);
      await editTitle(page);
      const github = page.getByRole("link", { name: "GitHub repository" });
      await github.click();
      await expect.poll(() => dialogs).toEqual([confirmMessage]);
      await expect(page).toHaveURL(/\/forms$/u);
      accept = true;
      await github.click();
      await expect(page).toHaveURL(/github\.com/u);
      expect(dialogs).toEqual([confirmMessage, confirmMessage]);
    });

    test("closing the tab shows the browser's own dialog", async ({ page }) => {
      const dialogs = answerDialogs(page, () => true);
      await openForms(page);
      await editTitle(page);
      await page.close({ runBeforeUnload: true });
      await expect
        .poll(() => dialogs.map((dialog) => dialog.split(":")[0]))
        .toEqual(["beforeunload"]);
    });
  });
});
