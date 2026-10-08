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

// SvelteKit 2 passes no `kind`, but `status` and the `message` it would show.
describe("without a kind, as in SvelteKit 2", () => {
  test("the client hook keeps and logs every error", () => {
    const log = logged();
    const error = new TodoNotFound({ id: 7 });
    expect(
      handleClientError({ error, message: "Internal Error" })
    ).toStrictEqual({ message: "Todo 7 not found", tag: "TodoNotFound" });
    expect(
      handleClientError({ error: { _tag: "Plain" }, message: "Not Found" })
    ).toStrictEqual({ message: "Not Found", tag: "Plain" });
    expect(log).toHaveBeenCalledTimes(2);
  });

  test("the server hook keeps the _tag and SvelteKit's message, and logs every error", () => {
    const log = logged();
    const error = new TodoNotFound({ id: 7 });
    expect(
      handleServerError({ error, message: "Internal Error" })
    ).toStrictEqual({ message: "Internal Error", tag: "TodoNotFound" });
    const untagged = new Error("database password is hunter2");
    expect(
      handleServerError({ error: untagged, message: "Internal Error" })
    ).toStrictEqual({ message: "Internal Error" });
    expect(log).toHaveBeenCalledWith(error);
    expect(log).toHaveBeenCalledWith(untagged);
  });
});

describe("handleClientError without a kind, as in SvelteKit 2", () => {
  test("uses SvelteKit's message for an error whose own message is empty", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // SvelteKit 2 shows whatever message the hook returns, and needs one.
    expect(
      handleClientError({ error: new Unexplained(), message: "Internal Error" })
    ).toStrictEqual({ message: "Internal Error", tag: "Unexplained" });
    expect(
      handleClientError({
        // oxlint-disable-next-line unicorn/error-message -- an empty message is the case under test
        error: new Error(""),
        message: "Internal Error",
      })
    ).toStrictEqual({ message: "Internal Error" });
  });
});
