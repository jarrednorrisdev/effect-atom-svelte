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

  test("lifetimes: a finalizer stops each computation's timer", async ({
    page,
  }) => {
    await page.goto("/lifetimes");
    await expect(page.locator("html[data-hydrated]")).toBeAttached();
    const press = (name: string, on: boolean) =>
      setPressed(page.getByRole("button", { exact: true, name }), on);
    const timers = page.getByTestId("timers").getByRole("listitem");
    const running = page.getByLabel("setInterval timers running", {
      exact: true,
    });

    await press("Show the clock", true);
    await expect(timers).toHaveText([
      /timer 1 · every 1 s.*running for the clock$/su,
    ]);
    // Before computing again, the atom's finalizer stops the old timer.
    await press("0.25 s", true);
    await expect(timers).toHaveText([
      /timer 1 .*stopped by the finalizer: tickIntervalAtom changed$/su,
      /timer 2 · every 0.25 s.*running for the clock$/su,
    ]);
    // Unread, the atom is disposed, and its finalizer stops the last one.
    await press("Show the clock", false);
    await expect(timers.nth(1)).toHaveText(
      /stopped by the finalizer: nothing reads tickCountAtom$/su
    );
    await expect(running).toHaveText("0");

    // Without the finalizer, the timer outlives the atom.
    await press("Clear in a finalizer", false);
    await press("Show the clock", true);
    await press("Show the clock", false);
    await expect(timers.nth(2)).toHaveText(
      /leaked: still ticking, nothing uses it$/su
    );
    await expect(running).toHaveText("1");
    await page.getByRole("button", { exact: true, name: "Reset" }).click();
    await expect(timers).toHaveCount(0);
    await expect(page.getByTestId("timers")).toContainText("None yet.");
  });

  test("lifetimes: a layout's useAtomMount keeps an atom across pages", async ({
    page,
  }) => {
    await page.goto("/lifetimes");
    await expect(page.locator("html[data-hydrated]")).toBeAttached();
    const pages = page.getByRole("navigation", { name: "Pages" });
    const open = async (name: string) => {
      const link = pages.getByRole("button", { exact: true, name });
      await expect(async () => {
        await link.click();
        await expect(link).toHaveAttribute("aria-current", "page", {
          timeout: 1000,
        });
      }).toPass();
    };
    const messages = page.getByTestId("chat-messages").getByRole("listitem");
    const log = page.getByTestId("messages-log").getByRole("listitem");
    const send = async (text: string) => {
      await page.getByLabel("Message", { exact: true }).fill(text);
      await page.getByRole("button", { exact: true, name: "Send" }).click();
    };

    // The chat page holds messagesAtom only while it is open.
    await open("Chat");
    await send("Hello");
    await expect(messages).toHaveText(["Hello"]);
    await open("Inbox");
    await expect(log).toHaveText([
      /created, empty$/u,
      /disposed: messages lost$/u,
    ]);
    await open("Chat");
    await expect(messages).toHaveText(["No messages yet."]);

    // Held by the layout, the messages outlive the page.
    await setPressed(
      page.getByRole("button", {
        exact: true,
        name: "useAtomMount(messagesAtom)",
      }),
      true
    );
    await send("Still here");
    await open("Inbox");
    await expect(page.getByTestId("messages-status")).toContainText(
      "+layout.svelte · useAtomMount"
    );
    await open("Chat");
    await expect(messages).toHaveText(["Still here"]);
    await expect(log).toHaveCount(3);
  });

  test("families: equal keys return the same atom, unlike a Map", async ({
    page,
  }) => {
    await page.goto("/families");
    await page.waitForLoadState("networkidle");
    const family = page.getByRole("textbox", { name: "Atom.family draft" });
    const map = page.getByRole("textbox", { name: "new Map() draft" });
    // The same-key example's language pickers.
    const lang = (value: string) =>
      page
        .getByRole("button", { exact: true, name: `lang: "${value}"` })
        .first()
        .click();
    await family.fill("Hello");
    await map.fill("Hello");
    await lang("fr");
    await expect(family).toHaveValue("");
    await expect(map).toHaveValue("");
    await lang("en");
    // A new { doc: 1, lang: "en" } object: equal for the family, a miss for the Map.
    await expect(family).toHaveValue("Hello");
    await expect(map).toHaveValue("");
    await expect(page.getByTestId("made-family")).toHaveText(
      "2 atoms for 2 keys"
    );
    await expect(page.getByTestId("made-map")).toHaveText("3 atoms for 2 keys");
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
    const post = page.getByRole("group", { exact: true, name: "Post" });
    const reply = page.getByRole("group", { exact: true, name: "Reply" });
    // The reply is inside the post, so the post's own input is its first.
    const postDraft = post.getByLabel("Draft", { exact: true }).first();
    const replyDraft = reply.getByLabel("Draft", { exact: true });

    await postDraft.fill("A post");
    await expect(postDraft).toHaveValue("A post");
    await expect(replyDraft).toHaveValue("");
    await expect(reply).toContainText("0 words");
    await expect(reply).toContainText("Nothing written yet.");

    await replyDraft.fill("A short reply");
    await expect(reply).toContainText("3 words");
    await expect(postDraft).toHaveValue("A post");
    // Each part names the editor whose draft Draft.use() found: the nearest.
    const found = (group: typeof post) =>
      group.getByTitle("The editor whose draft Draft.use() found");
    await expect(found(reply)).toHaveText(["Reply", "Reply", "Reply"]);
    await expect(found(post)).toHaveText([
      "Post",
      "Post",
      "Post",
      "Reply",
      "Reply",
      "Reply",
    ]);
  });
});
