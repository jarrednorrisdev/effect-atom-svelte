import { expect, test } from "./servers.ts";
import { setPressed } from "./toggle.ts";

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
    await setPressed(
      page.getByRole("button", { exact: true, name: "savedAtom" }),
      true
    );
    await expect(followed).toHaveValue("Published post");
    await followed.fill("New post");
    await expect(page.getByTestId("saved")).toHaveText("New post");
    // draftAtom kept its value.
    await expect(page.getByTestId("draft")).toHaveText("Draft text");
    await setPressed(
      page.getByRole("button", { exact: true, name: "draftAtom" }),
      true
    );
    await expect(followed).toHaveValue("Draft text");
  });

  test("derived atoms: a derived atom runs once for every reader, a transform once per hook", async ({
    page,
  }) => {
    await page.goto("/derived-atoms");
    await page.waitForLoadState("networkidle");
    const atomRuns = page.getByLabel("doubledAtom runs", { exact: true });
    const transformRuns = page.getByLabel("transform runs", { exact: true });
    await expect(atomRuns).toHaveText("1");
    await expect(transformRuns).toHaveText("2");
    await page.getByRole("button", { name: "Add one to countAtom" }).click();
    await expect(page.getByTestId("shared-count")).toHaveText("2");
    await expect(atomRuns).toHaveText("2");
    await expect(transformRuns).toHaveText("4");
    await page.getByRole("button", { name: "Add one to countAtom" }).click();
    await expect(atomRuns).toHaveText("3");
    await expect(transformRuns).toHaveText("6");
  });

  test("lifetimes: useAtomMount holds an atom nothing reads", async ({
    page,
  }) => {
    await page.goto("/lifetimes");
    await page.waitForLoadState("networkidle");
    const entries = page
      .getByRole("list", { name: "socketAtom" })
      .getByRole("listitem");
    const status = page.getByTestId("lifetimes-socketAtom-status");
    const holders = page.getByLabel("socketAtom holders", { exact: true });
    await expect(status).toHaveText("not computed yet");

    await setPressed(
      page.getByRole("button", { exact: true, name: "Show <ChatPanel>" }),
      true
    );
    await expect(holders).toHaveText("1");
    await expect(status).toHaveText("mounted");
    await expect(entries).toHaveText([/socketAtom: computed$/u]);

    await setPressed(
      page.getByRole("button", { exact: true, name: "Show a <Reader>" }),
      true
    );
    await expect(page.getByTestId("lifetimes-socketAtom")).toContainText(
      "Reading connected"
    );
    // The panel goes, but the reader still holds the atom.
    await setPressed(
      page.getByRole("button", { exact: true, name: "Show <ChatPanel>" }),
      false
    );
    await page.waitForTimeout(300);
    await expect(entries).toHaveText([/socketAtom: computed$/u]);
    await expect(status).toHaveText("mounted");

    await setPressed(
      page.getByRole("button", { exact: true, name: "Show a <Reader>" }),
      false
    );
    await expect(status).toHaveText("disposed");
    await expect(entries).toHaveText([
      /socketAtom: computed$/u,
      /socketAtom: disposed$/u,
    ]);
  });

  test("families: equal keys return the same atom", async ({ page }) => {
    await page.goto("/families");
    await page.waitForLoadState("networkidle");
    const calls = page
      .getByRole("list", { name: "Calls" })
      .getByRole("listitem");
    const call = page.getByRole("button", { name: "Call draftAtom" });
    await call.click();
    await call.click();
    await page.getByTestId("key-lang").selectOption("fr");
    await call.click();
    await page.getByTestId("key-lang").selectOption("en");
    await call.click();
    await expect(calls).toHaveText([
      'draftAtom({ doc: 1, lang: "en" }) new atom: the recipe ran',
      'draftAtom({ doc: 1, lang: "en" }) same atom as call 1',
      'draftAtom({ doc: 1, lang: "fr" }) new atom: the recipe ran',
      'draftAtom({ doc: 1, lang: "en" }) same atom as call 1',
    ]);
    await expect(page.getByTestId("key-atoms").locator("output")).toHaveText(
      "2 / 4 keys called"
    );
  });

  test("families: plain, idle TTL and keepAlive families keep their atoms differently", async ({
    page,
  }) => {
    await page.goto("/families");
    await page.waitForLoadState("networkidle");
    const entries = (name: string) =>
      page.getByTestId(`kept-${name}-entries`).locator("output");
    const addOne = (name: string) =>
      page.getByRole("button", { name: `${name}: add one` }).click();
    await addOne("plain");
    await addOne("idle TTL");
    await addOne("keepAlive");
    await expect(page.getByTestId("kept-plain")).toHaveText("1");
    await expect(page.getByTestId("kept-keepAlive")).toHaveText("1");

    await page.getByTestId("kept-fruit").selectOption("pears");
    await expect(page.getByTestId("kept-plain")).toHaveText("0");
    await expect(entries("plain")).toHaveText("1 / 3 in the registry");
    await expect(entries("idle TTL")).toHaveText("2 / 3 in the registry");
    await expect(entries("keepAlive")).toHaveText("2 / 3 in the registry");
    // The idle TTL is four seconds.
    await expect(entries("idle TTL")).toHaveText("1 / 3 in the registry", {
      timeout: 8000,
    });
    await expect(entries("keepAlive")).toHaveText("2 / 3 in the registry");

    await page.getByTestId("kept-fruit").selectOption("apples");
    await expect(page.getByTestId("kept-plain")).toHaveText("0");
    await expect(page.getByTestId("kept-idle TTL")).toHaveText("0");
    await expect(page.getByTestId("kept-keepAlive")).toHaveText("1");
  });

  test("AtomRef: a collection notifies an item's readers and the list's", async ({
    page,
  }) => {
    await page.goto("/refs");
    await page.waitForLoadState("networkidle");
    const listCount = page.getByLabel("todos notifications", { exact: true });
    const itemCount = (title: string) =>
      page.getByLabel(`${title} notifications`, { exact: true });
    const open = page.getByTestId("todos-open");
    await expect(open).toHaveText("1 of 2 open");
    await expect(listCount).toHaveText("0");

    await page.getByRole("checkbox", { name: "Write the docs" }).check();
    await expect(open).toHaveText("0 of 2 open");
    await expect(itemCount("Write the docs")).toHaveText("1");
    await expect(listCount).toHaveText("1");
    await expect(itemCount("Fix the bug")).toHaveText("0");

    await page.getByRole("textbox", { name: "New todo" }).fill("Ship it");
    await page.getByRole("button", { name: "Add todo" }).click();
    await expect(open).toHaveText("1 of 3 open");
    await expect(listCount).toHaveText("2");
    await expect(itemCount("Ship it")).toHaveText("0");

    await page.getByRole("button", { name: "Remove Fix the bug" }).click();
    await expect(open).toHaveText("1 of 2 open");
    await expect(listCount).toHaveText("3");
    await expect(itemCount("Write the docs")).toHaveText("1");
  });

  test("scoped atoms: use finds the nearest provider", async ({ page }) => {
    await page.goto("/scoped-atoms");
    await page.waitForLoadState("networkidle");
    const count = (name: string) =>
      page.getByLabel(`${name} count`, { exact: true });
    await page.getByRole("button", { name: "Outer: add one" }).click();
    await page.getByRole("button", { name: "Outer: add one" }).click();
    await expect(count("Outer")).toHaveText("2");
    await expect(count("Inner")).toHaveText("0");
    await page.getByRole("button", { name: "Inner: add one" }).click();
    await expect(count("Inner")).toHaveText("1");
    await expect(count("Outer")).toHaveText("2");
  });
});
