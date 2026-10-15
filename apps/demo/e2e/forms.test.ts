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
  // Typed before hydration, a title can be lost (WebKit on CI): wait
  // for the layout's mark, as the other e2e tests do.
  await expect(page.locator("html[data-hydrated]")).toBeAttached();
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
  await expect(page.getByTestId("state-dirty")).toHaveText("true");
};

const confirmMessage = "confirm: Discard the new title?";

test.describe("Forms page", () => {
  test("sign up: a check fails at once, its error waits for blur, and form.valid waits for every check", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await openForms(page);
    const form = page.getByTestId("sign-up");
    const email = form.getByLabel("Email");
    const emailRow = page.getByTestId("knows-email");
    await email.fill("ada");
    await expect(emailRow).toContainText("Enter an email address");
    await expect(emailRow).toContainText("hidden");
    await expect(form.getByText("Enter an email address")).toHaveCount(0);
    await email.press("Tab");
    await expect(form.getByText("Enter an email address")).toBeVisible();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await email.fill("ada@example.com");
    await expect(form.getByText("Enter an email address")).toHaveCount(0);
    // Your scenario: a too-short password, a confirm that differs, then the password fixed.
    // The mismatch shows on confirm at once, before the email or the terms are right.
    const password = form.getByLabel("Password", { exact: true });
    await email.fill("ada");
    await password.fill("short");
    await password.press("Tab");
    await form.getByLabel("Confirm password").fill("longpasswor");
    await form.getByLabel("Confirm password").press("Tab");
    await password.fill("longpassword");
    await expect(form.getByText("Passwords do not match")).toBeVisible();
    await email.fill("ada@example.com");
    await form.getByLabel("I agree to the terms").check();
    await expect(page.getByTestId("knows-password.confirm")).toContainText(
      "Passwords do not match"
    );
    await expect(page.getByTestId("knows-valid")).toHaveText("false");
    const create = form.getByRole("button", { name: "Create account" });
    await form.getByLabel("Confirm password").fill("longpassword");
    await expect(page.getByTestId("knows-valid")).toHaveText("true");
    await create.click();
    await expect(page.getByTestId("sign-up-done")).toHaveText(
      "Account created for ada@example.com"
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
    await expect(page.getByTestId("state-result")).toHaveText("Success");
    await expect(page.getByTestId("state-dirty")).toHaveText("false");
    await expect(page.getByTestId("state-initial")).toHaveText(
      '{"title":"Read the Atom source"}'
    );
    await expect(form.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(errors).toEqual([]);
    // The query fetched the saved title, and a reload renders it on the server. Checked for errors
    // first: WebKit reports imports the reload cuts short as page errors.
    await page.reload();
    await expect(
      page.getByTestId("rename").getByLabel("Title of todo 1")
    ).toHaveValue("Read the Atom source");
  });

  test("order: an item's error moves with it", async ({ page }) => {
    const errors = pageErrors(page);
    await openForms(page);
    const form = page.getByTestId("order");
    const items = form.getByTestId("order-item");
    await form.getByRole("button", { name: "Place order" }).click();
    await expect(items.nth(1)).toContainText("Enter a quantity");
    const inkKey =
      (await items.nth(1).getByTestId("order-key").textContent()) ?? "";
    await expect(form.getByLabel("Quantity of item 2")).toBeFocused();
    await items.nth(1).getByRole("button", { name: "Move to top" }).click();
    await expect(form.getByLabel("Item 1", { exact: true })).toHaveValue("Ink");
    await expect(form.getByTestId("order-key").first()).toHaveText(inkKey);
    await expect(items.nth(0)).toContainText("Enter a quantity");
    await expect(items.nth(1)).not.toContainText("Enter a quantity");
    await form.getByLabel("Quantity of item 1").fill("3");
    await form.getByRole("button", { name: "Place order" }).click();
    await expect(page.getByTestId("order-placed")).toHaveText(
      "3 × Ink, 2 × Paper, 1 × Stapler"
    );
    expect(errors).toEqual([]);
  });

  test("checkout: switching the union's tag keeps the other member's values, and only the chosen one is checked", async ({
    page,
  }) => {
    const errors = pageErrors(page);
    await openForms(page);
    const form = page.getByTestId("checkout");
    const delivery = form.getByRole("group", { name: "Delivery address" });
    await delivery.getByLabel("Street").fill("1 High St");
    await form.getByRole("button", { exact: true, name: "Pickup" }).click();
    await expect(delivery).toHaveCount(0);
    await form.getByRole("button", { exact: true, name: "Delivery" }).click();
    await expect(delivery.getByLabel("Street")).toHaveValue("1 High St");
    await form.getByRole("button", { exact: true, name: "Pickup" }).click();
    await form.getByRole("button", { name: "Place order" }).click();
    await expect(form.getByText("Choose a store")).toBeVisible();
    await expect(form.getByText("Enter a street")).toBeVisible();
    await form.getByRole("button", { exact: true, name: "Camden" }).click();
    const billing = form.getByRole("group", { name: "Billing address" });
    await billing.getByLabel("Street").fill("2 Low Rd");
    await billing.getByLabel("City").fill("London");
    await form.getByRole("button", { name: "Place order" }).click();
    await expect(page.getByTestId("checkout-placed")).toHaveText(
      "Pickup at Camden"
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
      await expect(page.locator("html[data-hydrated]")).toBeAttached();
      await page.waitForLoadState("networkidle");
      await page
        .getByRole("navigation", { name: "Docs" })
        .getByRole("link", { exact: true, name: "Forms" })
        .click();
      await expect(page).toHaveURL(/\/forms$/u);
      await page.waitForLoadState("networkidle");
      await editTitle(page);
      await page.evaluate(() => {
        history.back();
      });
      await expect.poll(() => dialogs).toEqual([confirmMessage]);
      await expect(page).toHaveURL(/\/forms$/u);
      await expect(page.getByTestId("state-dirty")).toHaveText("true");
      accept = true;
      await page.evaluate(() => {
        history.back();
      });
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
