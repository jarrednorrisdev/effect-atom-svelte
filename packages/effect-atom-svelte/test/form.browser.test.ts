// useForm in components: attributes, timing in the DOM, submit, lifetimes and hydration.
import { hydrate, unmount } from "svelte";
import type { Component } from "svelte";
import { describe, expect, onTestFinished, test } from "vitest";
import { render } from "vitest-browser-svelte";
import { commands, userEvent } from "vitest/browser";

import { makeSlowSave } from "./fixtures/form-atoms.ts";
import FormDialog from "./fixtures/form-dialog.svelte";
import FormSignIn from "./fixtures/form-sign-in.svelte";
import FormSsr from "./fixtures/form-ssr.svelte";
import { sleep } from "./helpers.ts";

describe("a sign-in form", () => {
  test("an error waits for the user to leave the field, and is wired to the input", async () => {
    const screen = await render(FormSignIn);
    const email = screen.getByLabelText("Email");
    await email.fill("ada");
    await expect.element(email).not.toHaveAttribute("aria-invalid");
    await userEvent.tab();
    await expect.element(email).toHaveAttribute("aria-invalid", "true");
    const error = screen.getByText("Enter a valid email");
    await expect.element(error).toBeVisible();
    const describedBy = email.element().getAttribute("aria-describedby");
    expect(describedBy).toBe(error.element().id);
    // It has shown an error, so it rechecks as the user types.
    await email.fill("ada@example.com");
    await expect.element(email).not.toHaveAttribute("aria-invalid");
  });

  test("a failed submit shows every error and focuses the first field", async () => {
    const screen = await render(FormSignIn);
    await screen.getByRole("button", { name: "Sign in" }).click();
    await expect.element(screen.getByText("Enter your password")).toBeVisible();
    await expect.element(screen.getByLabelText("Email")).toHaveFocus();
  });

  test("mapError puts a claimed failure on the form", async () => {
    const screen = await render(FormSignIn);
    await screen.getByLabelText("Email").fill("ada@example.com");
    await screen.getByLabelText("Password").fill("wrong");
    await screen.getByRole("button", { name: "Sign in" }).click();
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Wrong email or password");
    await expect
      .element(screen.getByRole("status"))
      .toHaveTextContent("Initial");
  });
});

describe("lifetimes", () => {
  test("a save still finishes when the form is closed, and reopening shows a fresh form", async () => {
    const log: string[] = [];
    const save = makeSlowSave(log);
    const view = await render(FormDialog, { save });
    const title = view.getByLabelText("Title");
    await title.fill("Feed the dog");
    await view.getByRole("button", { name: "Save" }).click();
    await view.getByRole("button", { name: "Close" }).click();
    await expect.poll(() => log).toEqual(["saved Feed the dog"]);
    await view.getByRole("button", { name: "Open" }).click();
    await expect
      .element(view.getByLabelText("Title"))
      .toHaveValue("Feed the cat");
    await expect
      .element(view.getByRole("status"))
      .toHaveTextContent("clean Initial");
  });

  test("initial values that change replace a clean form's values, not a dirty one's", async () => {
    const view = await render(FormDialog, { save: makeSlowSave([]) });
    const title = view.getByLabelText("Title");
    await view.getByRole("button", { name: "Refetch" }).click();
    await expect.element(title).toHaveValue("Walk the dog");
    await title.fill("Mine");
    await view.getByRole("button", { name: "Close" }).click();
    await view.getByRole("button", { name: "Open" }).click();
    await expect
      .element(view.getByLabelText("Title"))
      .toHaveValue("Walk the dog");
  });

  test("a submitted edit form adopts its values, so it is clean again", async () => {
    const view = await render(FormDialog, { save: makeSlowSave([]) });
    await view.getByLabelText("Title").fill("Feed the dog");
    await expect
      .element(view.getByRole("status"))
      .toHaveTextContent("dirty Initial");
    await view.getByRole("button", { name: "Save" }).click();
    await expect
      .element(view.getByRole("status"))
      .toHaveTextContent("clean Success");
  });
});

describe("server rendering", () => {
  test("the server's ids match the browser's, so hydration keeps the inputs", async () => {
    const { body, head } = await commands.renderOnServer(
      "/test/fixtures/form-ssr.svelte"
    );
    const script = document.createElement("script");
    script.textContent =
      new DOMParser().parseFromString(head, "text/html").querySelector("script")
        ?.textContent ?? "";
    document.head.append(script);
    const target = document.createElement("div");
    target.innerHTML = body;
    document.body.append(target);
    const serverInput = target.querySelector("input");
    const serverId = serverInput?.id;
    expect(serverId).toBeTruthy();
    const warnings: unknown[] = [];
    const { warn } = console;
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };
    const app = hydrate(FormSsr as Component, { props: {}, target });
    onTestFinished(async () => {
      console.warn = warn;
      await unmount(app);
      target.remove();
      script.remove();
      Reflect.deleteProperty(window, "__svelte");
    });
    await sleep("10 millis");
    console.warn = warn;
    expect(target.querySelector("input")).toBe(serverInput);
    expect(target.querySelector("label")?.getAttribute("for")).toBe(serverId);
    expect(warnings).toEqual([]);
  }, 120_000);
});
