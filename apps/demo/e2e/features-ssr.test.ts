// The live examples on the server rendering pages: Server rendering, SvelteKit and Hydration
// (JND-82). Every page here is prerendered, so "the server" is the build.
import { expect, test } from "./servers.ts";

test.describe("Server rendering page", () => {
  test("each request has its own registry, and module state is shared", async ({
    page,
  }) => {
    await page.goto("/server-rendering");
    await page.waitForLoadState("networkidle");
    const first = page.getByTestId("request-1");
    const second = page.getByTestId("request-2");
    const added = page.getByLabel("Added in all requests");

    await first.getByRole("button", { name: "Add to cart" }).click();
    await first.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByLabel("Request 1 cart")).toHaveText("2");
    await expect(page.getByLabel("Request 2 cart")).toHaveText("0");
    await expect(added).toHaveText("2");

    await second.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByLabel("Request 2 cart")).toHaveText("1");
    await expect(added).toHaveText("3");

    // Ending a request disposes of its registry; the next one starts empty.
    await first.getByRole("button", { name: "End request" }).click();
    await expect(first).toHaveCount(0);
    await expect(page.getByLabel("Request 3 cart")).toHaveText("0");
    await expect(page.getByLabel("Request 2 cart")).toHaveText("1");
    await expect(added).toHaveText("3");
  });

  test("the HTML has what the render waited for, and the browser fills in the rest", async ({
    page,
  }) => {
    await page.goto("/server-rendering");
    for (const [id, html, now] of [
      ["waits-script", "Computed on the server", "Computed on the server"],
      ["waits-markup", "Computed on the server", "Computed on the server"],
      ["waits-later", "Pending snippet", "Computed in the browser"],
      ["waits-value", "Initial, waiting", "Computed in the browser"],
    ] as const) {
      await expect(page.getByTestId(`${id}-html`)).toHaveText(html);
      await expect(page.getByTestId(id)).toHaveText(now);
    }
  });

  test("server values: the server renders 1024 and Initial, the browser its own", async ({
    page,
  }) => {
    await page.goto("/server-rendering");
    await expect(page.getByTestId("width-html")).toHaveText("1024 px");
    await expect(page.getByTestId("quota-html")).toHaveText("Initial, waiting");
    const width = page.viewportSize()?.width ?? 0;
    await expect(page.getByTestId("width")).toHaveText(`${width} px`);
    await expect(page.getByTestId("quota")).toHaveText(/^\d+\.\d GB$/u);

    await page.setViewportSize({ height: 720, width: 1000 });
    await expect(page.getByTestId("width")).toHaveText("1000 px");
  });
});
