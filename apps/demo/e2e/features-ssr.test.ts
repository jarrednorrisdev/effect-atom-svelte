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

    // A new request starts empty; a moment later the oldest ends, which disposes of its registry.
    await page.getByRole("button", { name: "Send another request" }).click();
    await expect(page.getByLabel("Request 3 cart")).toHaveText("0");
    await expect(page.getByTestId("request-1-ended")).toBeVisible();
    await expect(first).toHaveCount(0);
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

test.describe("SvelteKit page", () => {
  test("the failed snippet tells typed errors apart by their tag", async ({
    page,
  }) => {
    await page.goto("/sveltekit");
    await page.waitForLoadState("networkidle");
    const todo = page.getByTestId("boundary-todo");
    const failed = page.getByTestId("boundary-failed");
    const body = page.getByTestId("error-body");
    await expect(todo).toHaveText("Write the docs");

    await page.getByRole("button", { name: "Todo 7, missing" }).click();
    await expect(failed).toHaveText("No such todo.");
    await expect(body).toContainText(
      '{ message: "There is no todo 7", tag: "TodoNotFound" }'
    );

    await page.getByRole("button", { name: "A slow todo" }).click();
    await expect(failed).toHaveText(
      "The server took too long. Try again later."
    );
    await expect(body).toContainText('tag: "Timeout"');

    // A defect has no tag, so only its message arrives.
    await page.getByRole("button", { name: "A broken response" }).click();
    await expect(failed).toHaveText("The response was not JSON");
    await expect(body).toContainText(
      '{ message: "The response was not JSON" }'
    );

    await page.getByRole("button", { name: "Todo 1" }).click();
    await expect(todo).toHaveText("Write the docs");
  });

  test("each card awaits its own todo, on the server and then in the browser", async ({
    page,
    request,
  }) => {
    const response = await request.get("/sveltekit");
    const html = await response.text();
    expect(html).toContain("Write the docs");
    expect(html).toContain("Ship 0.1.0");

    await page.goto("/sveltekit");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("card-1")).toContainText(
      "Computed on the server"
    );
    await expect(page.getByTestId("card-2")).toContainText("Ship 0.1.0");
    await expect(page.getByTestId("card-2")).toContainText(
      "Computed on the server"
    );

    await page.getByRole("button", { name: "Show another todo" }).click();
    const third = page.getByTestId("card-3");
    await expect(third).toContainText("Propose it upstream");
    await expect(third).toContainText("Computed in the browser");
    await expect(page.getByTestId("card-1")).toContainText(
      "Computed on the server"
    );
  });

  test("a prerendered atom's result is from the build until it runs again", async ({
    page,
  }) => {
    await page.goto("/sveltekit");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("stamp-where")).toHaveText(
      "Computed on the server"
    );
    await expect(page.getByTestId("stamp-age")).toHaveText(/ago$|^just now$/u);

    await page.getByRole("button", { name: "Compute again" }).click();
    await expect(page.getByTestId("stamp-where")).toHaveText(
      "Computed in the browser"
    );
    await expect(page.getByTestId("stamp-age")).toHaveText(
      /^just now$|^\d seconds ago$/u
    );
  });
});

test.describe("Hydration page", () => {
  test("only a serializable atom read by useAtomResult keeps the server's result", async ({
    page,
  }) => {
    await page.goto("/hydration");
    for (const [id, html, now] of [
      ["travel-keyed", "Computed on the server", "Computed on the server"],
      ["travel-plain", "Computed on the server", "Computed in the browser"],
      ["travel-value-only", "Initial, waiting", "Computed in the browser"],
    ] as const) {
      await expect(page.getByTestId(`${id}-html`)).toHaveText(html);
      await expect(page.getByTestId(id)).toHaveText(now);
    }
  });

  test("revalidateOnHydrate runs the atom again in the browser", async ({
    page,
  }) => {
    await page.goto("/hydration");
    await expect(page.getByTestId("revalidate-kept-html")).toHaveText(
      "Computed on the server"
    );
    await expect(page.getByTestId("revalidate-fresh-html")).toHaveText(
      "Computed on the server"
    );
    await expect(page.getByTestId("revalidate-fresh-where")).toHaveText(
      "Computed in the browser"
    );
    await expect(page.getByTestId("revalidate-kept-where")).toHaveText(
      "Computed on the server"
    );
  });

  test("a saved filter applies after mounting, without a hydration warning", async ({
    page,
  }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning" || message.type() === "error") {
        warnings.push(message.text());
      }
    });
    await page.goto("/hydration");
    await page.waitForLoadState("networkidle");
    const list = page.getByTestId("filtered-todos").getByRole("listitem");
    await expect(list).toHaveCount(3);
    await expect(page.getByTestId("filtered-where")).toHaveText(
      "Computed on the server"
    );

    const example = page
      .locator("[data-example]")
      .filter({ has: page.getByRole("group", { name: "Saved filter" }) });
    const filter = (name: string) =>
      example
        .getByRole("group", { name: "Saved filter" })
        .getByRole("button", { exact: true, name });
    await filter("done").click();
    await expect(filter("done")).toHaveAttribute("aria-pressed", "true");
    await expect(list).toHaveText(["Write the docs"]);
    await expect(page.getByTestId("filtered-where")).toHaveText(
      "Computed in the browser"
    );

    // What the example's Reload the page button does.
    const reloaded = page.waitForEvent("load");
    await example.getByRole("button", { name: "Reload the page" }).click();
    await reloaded;
    await page.waitForLoadState("networkidle");
    await expect(filter("done")).toHaveAttribute("aria-pressed", "true");
    await expect(list).toHaveText(["Write the docs"]);
    await expect(page.getByTestId("filtered-where")).toHaveText(
      "Computed in the browser"
    );
    // The server has no saved filter, so its HTML lists every todo.
    await expect(
      example.getByText("Write the docs, Ship 0.1.0, Propose it upstream")
    ).toBeVisible();
    expect(warnings.filter((text) => text.includes("hydrat"))).toEqual([]);
  });

  test("HydrationBoundary hydrates a remote function's state", async ({
    page,
  }) => {
    const remote: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/_app/remote/")) {
        remote.push(request.url());
      }
    });
    await page.goto("/hydration");
    // Wrapped with withReactivity, so Effect's Hydration.hydrate runs it again.
    await expect(page.getByTestId("pricesWithKeysAtom")).toContainText(
      "Computed in the browser"
    );
    await expect(page.getByTestId("pricesAtom")).toContainText(
      "Computed on the server"
    );
    // The prerendered result was in the page, so the browser didn't call the function.
    expect(remote).toEqual([]);
  });
});
