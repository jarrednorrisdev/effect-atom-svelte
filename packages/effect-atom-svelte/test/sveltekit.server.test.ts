import { Data } from "effect";
import { afterEach, describe, expect, test, vi } from "vitest";

import { handleClientError, handleServerError } from "../src/SvelteKit.ts";

class TodoNotFound extends Data.TaggedError("TodoNotFound")<{
  readonly id: number;
}> {
  override get message() {
    return `Todo ${this.id} not found`;
  }
}

class Unexplained extends Data.TaggedError("Unexplained") {}

// Silences console.error and records what the hooks log.
const logged = () =>
  vi.spyOn(console, "error").mockImplementation(() => undefined);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleClientError", () => {
  test("keeps the message and _tag of an Effect error", () => {
    const log = logged();
    const error = new TodoNotFound({ id: 7 });
    expect(handleClientError({ error, kind: "unknown" })).toStrictEqual({
      message: "Todo 7 not found",
      tag: "TodoNotFound",
    });
    expect(log).toHaveBeenCalledWith(error);
  });

  test("keeps the message of an untagged error, without a tag", () => {
    logged();
    expect(
      handleClientError({ error: new Error("boom"), kind: "unknown" })
    ).toStrictEqual({ message: "boom" });
  });

  test("keeps a thrown string as the message", () => {
    logged();
    expect(handleClientError({ error: "boom", kind: "unknown" })).toStrictEqual(
      { message: "boom" }
    );
  });

  test("keeps SvelteKit's message when the error has none", () => {
    logged();
    expect(
      handleClientError({ error: new Unexplained(), kind: "unknown" })
    ).toStrictEqual({ tag: "Unexplained" });
    expect(
      handleClientError({ error: { _tag: "Plain" }, kind: "unknown" })
    ).toStrictEqual({ tag: "Plain" });
    expect(handleClientError({ error: null, kind: "unknown" })).toBeUndefined();
  });

  test("leaves app and framework errors to SvelteKit", () => {
    const log = logged();
    const error = { message: "Not Found", status: 404 };
    expect(handleClientError({ error, kind: "framework" })).toBeUndefined();
    expect(handleClientError({ error, kind: "app" })).toBeUndefined();
    expect(log).not.toHaveBeenCalled();
  });
});

describe("handleServerError", () => {
  test("keeps the _tag but not the message of an Effect error", () => {
    const log = logged();
    const error = new TodoNotFound({ id: 7 });
    expect(handleServerError({ error, kind: "unknown" })).toStrictEqual({
      tag: "TodoNotFound",
    });
    expect(log).toHaveBeenCalledWith(error);
  });

  test("keeps SvelteKit's defaults for an untagged error, and logs it", () => {
    const log = logged();
    const error = new Error("database password is hunter2");
    expect(handleServerError({ error, kind: "unknown" })).toBeUndefined();
    expect(log).toHaveBeenCalledWith(error);
  });

  test("leaves app and framework errors to SvelteKit, without logging", () => {
    const log = logged();
    const error = { message: "Not Found", status: 404 };
    expect(handleServerError({ error, kind: "framework" })).toBeUndefined();
    expect(handleServerError({ error, kind: "app" })).toBeUndefined();
    expect(log).not.toHaveBeenCalled();
  });

  test("logs the issues of a validation error", () => {
    const log = logged();
    const issues = [{ message: "Expected a number" }];
    expect(
      handleServerError({
        error: { message: "Bad Request", status: 400 },
        issues,
        kind: "validation",
      })
    ).toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      "Remote function schema validation failed:",
      issues
    );
  });
});
