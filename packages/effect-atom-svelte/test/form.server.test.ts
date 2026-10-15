// Form instances without Svelte: values, validation timing, submit and arrays.
import { Data, Effect, Exit, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, test } from "vitest";

import { Form } from "../src/index.ts";
import { sleep } from "./helpers.ts";

const tick = () => sleep(0);

const SignIn = Form.make(
  Schema.Struct({
    email: Schema.String.check(
      Schema.isPattern(/^\S+@\S+$/u, { message: "Enter a valid email" })
    ),
    password: Schema.String.check(
      Schema.isNonEmpty({ message: "Enter your password" })
    ),
  })
);

const signIn = () =>
  Form.instance(SignIn, {
    id: "f",
    initialValues: { email: "", password: "" },
  });

describe("values", () => {
  test("a field reads and writes its value, and knows whether it's dirty", () => {
    const form = signIn();
    const email = form.field("email");
    expect(email.value).toBe("");
    email.value = "ada@example.com";
    expect(form.values).toEqual({ email: "ada@example.com", password: "" });
    expect(email.dirty).toBe(true);
    expect(form.field("password").dirty).toBe(false);
    expect(form.dirty).toBe(true);
    form.reset();
    expect(form.values.email).toBe("");
    expect(form.dirty).toBe(false);
    form.dispose();
  });

  test("ids and names come from the instance id and the path", () => {
    const form = signIn();
    const email = form.field("email");
    expect(email.attrs).toMatchObject({ id: "f-email", name: "email" });
    expect(email.errorId).toBe("f-email-error");
    form.dispose();
  });
});

describe("validation timing", () => {
  test("an error waits for blur, then follows input until it passes", async () => {
    const form = signIn();
    const email = form.field("email");
    email.value = "ada";
    await tick();
    expect(email.error).toBeUndefined();
    email.blur();
    expect(email.error).toBe("Enter a valid email");
    expect(email.touched).toBe(true);
    email.value = "ada@example.com";
    await tick();
    expect(email.error).toBeUndefined();
    // It has shown an error, so input reveals the next one.
    email.value = "ada@";
    await tick();
    expect(email.error).toBe("Enter a valid email");
    form.dispose();
  });

  test("submit reveals every error and reports them", async () => {
    const form = signIn();
    const exit = await form.submit();
    expect(Exit.isFailure(exit)).toBe(true);
    expect(form.errors.map((entry) => entry.path)).toEqual([
      ["email"],
      ["password"],
    ]);
    expect(form.field("password").error).toBe("Enter your password");
    expect(form.submitCount).toBe(1);
    form.dispose();
  });

  test("valid follows the values without showing anything", async () => {
    const form = signIn();
    await tick();
    expect(form.valid).toBe(false);
    form.setValues({ email: "ada@example.com", password: "x" });
    await tick();
    expect(form.valid).toBe(true);
    expect(form.errors).toEqual([]);
    form.dispose();
  });

  test("validate(paths) shows only those paths", async () => {
    const form = signIn();
    expect(await form.validate(["email"])).toBe(false);
    expect(form.field("email").error).toBe("Enter a valid email");
    expect(form.field("password").error).toBeUndefined();
    form.field("email").value = "ada@example.com";
    expect(await form.validate(["email"])).toBe(true);
    form.dispose();
  });
});

describe("messages", () => {
  const Reset = Schema.Struct({
    confirmPassword: Schema.String,
    password: Schema.String.check(Schema.isMinLength(8)),
  }).check(
    Schema.makeFilter(
      ({ password, confirmPassword }) =>
        password === confirmPassword || {
          issue: "Mismatch",
          path: ["confirmPassword"],
        },
      { message: "Passwords do not match" }
    )
  );

  test("an annotated cross-field message lands on its path and beats a custom hook", async () => {
    const form = Form.instance(
      Form.make(Reset, { checkHook: () => "hooked", leafHook: () => "leaf" }),
      {
        id: "r",
        initialValues: { confirmPassword: "abcdefgy", password: "abcdefgh" },
      }
    );
    await form.submit();
    expect(form.errors).toEqual([
      { message: "Passwords do not match", path: ["confirmPassword"] },
    ]);
    form.field("password").value = "abc";
    await tick();
    // The check on the length is unannotated, so the hook names it.
    expect(form.field("password").error).toBe("hooked");
    form.dispose();
  });
});

class Taken extends Data.TaggedError("Taken")<{ readonly email: string }> {}
class Boom extends Data.TaggedError("Boom")<{ readonly reason: string }> {}

describe("submit", () => {
  test("success adopts the submitted values as initial values", async () => {
    const save = Atom.fn((input: { email: string }) =>
      Effect.succeed(input.email.length)
    );
    const form = Form.instance(SignIn, {
      id: "s",
      initialValues: { email: "", password: "" },
      submit: { atom: save },
    });
    form.setValues({ email: "ada@example.com", password: "x" });
    const exit = await form.submit();
    expect(exit).toEqual(Exit.succeed(15));
    expect(form.dirty).toBe(false);
    expect(Option.getOrThrow(form.lastSubmitted).encoded.email).toBe(
      "ada@example.com"
    );
    expect(AsyncResult.isSuccess(form.submitResult)).toBe(true);
    form.dispose();
  });

  test("mapError claims a failure onto a field, and an edit clears it", async () => {
    const save = Atom.fn((input: { email: string }) =>
      Effect.fail(new Taken(input))
    );
    const form = Form.instance(SignIn, {
      id: "s",
      initialValues: { email: "ada@example.com", password: "x" },
      mapError: (error) =>
        error._tag === "Taken" ? { fields: { email: "Taken" } } : undefined,
      submit: { atom: save },
    });
    await form.submit();
    expect(form.field("email").error).toBe("Taken");
    expect(AsyncResult.isInitial(form.submitResult)).toBe(true);
    form.field("email").value = "bob@example.com";
    expect(form.field("email").error).toBeUndefined();
    form.dispose();
  });

  test("an unclaimed failure stays in submitResult", async () => {
    const save = Atom.fn((input: { email: string }) =>
      Effect.fail(new Boom({ reason: input.email }))
    );
    const form = Form.instance(SignIn, {
      id: "s",
      initialValues: { email: "ada@example.com", password: "x" },
      mapError: () => undefined,
      submit: { atom: save },
    });
    await form.submit();
    expect(AsyncResult.isFailure(form.submitResult)).toBe(true);
    form.dispose();
  });

  test("a second submit while one runs gets the same result, and payload gets args", async () => {
    let calls = 0;
    const save = Atom.fn((input: { id: number; email: string }) =>
      Effect.sleep("10 millis").pipe(
        Effect.map(() => {
          calls += 1;
          return input.id;
        })
      )
    );
    const form = Form.instance(SignIn, {
      id: "s",
      initialValues: { email: "ada@example.com", password: "x" },
      submit: {
        atom: save,
        payload: (decoded, id: number) => ({ email: decoded.email, id }),
      },
    });
    const [a, b] = await Promise.all([form.submit(7), form.submit(8)]);
    expect(a).toEqual(Exit.succeed(7));
    expect(b).toBe(a);
    expect(calls).toBe(1);
    form.dispose();
  });

  test("a submit that settles after a reset leaves the fresh form alone", async () => {
    const save = Atom.fn<{ email: string }>()(() =>
      Effect.sleep("10 millis").pipe(Effect.as("saved"))
    );
    const form = Form.instance(SignIn, {
      id: "s",
      initialValues: { email: "ada@example.com", password: "x" },
      submit: { atom: save },
    });
    const pending = form.submit();
    await tick();
    expect(form.submitting).toBe(true);
    form.reset();
    expect(form.submitting).toBe(false);
    await pending;
    expect(AsyncResult.isInitial(form.submitResult)).toBe(true);
    expect(Option.isNone(form.lastSubmitted)).toBe(true);
    form.dispose();
  });
});

describe("arrays", () => {
  const Order = Form.make(
    Schema.Struct({
      items: Schema.Array(
        Schema.Struct({
          name: Schema.NonEmptyString,
          qty: Schema.NonEmptyString,
        })
      ),
    })
  );

  test("an item's error and touched state move with it", async () => {
    const form = Form.instance(Order, {
      id: "o",
      initialValues: {
        items: [
          { name: "Paper", qty: "2" },
          { name: "Ink", qty: "" },
          { name: "Stapler", qty: "1" },
        ],
      },
    });
    await form.submit();
    const items = form.array("items");
    expect(items.items[1]?.fields.field("qty").error).toBeDefined();
    const key = items.items[1]?.key;
    items.move(1, 0);
    expect(items.items[0]?.key).toBe(key);
    expect(form.field(["items", 0, "qty"]).error).toBeDefined();
    expect(form.field(["items", 1, "qty"]).error).toBeUndefined();
    await tick();
    expect(form.errors.map((entry) => entry.path)).toEqual([
      ["items", 0, "qty"],
    ]);
    items.remove(0);
    await tick();
    expect(form.errors).toEqual([]);
    form.dispose();
  });

  test("append gives a new key, and ids use it", () => {
    const form = Form.instance(Order, {
      id: "o",
      initialValues: { items: [] },
    });
    const items = form.array("items");
    items.append({ name: "", qty: "" });
    const [first] = items.items;
    expect(first?.fields.field("name").id).toBe(`o-items-i${first?.key}-name`);
    form.dispose();
  });
});

describe("constraints", () => {
  test("lengths, ranges and patterns come from the Schema's checks", () => {
    const Preset = Form.make(
      Schema.Struct({
        code: Schema.optional(
          Schema.String.check(Schema.isPattern(/[A-Z]{3}/u))
        ),
        name: Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(40)),
        width: Schema.NumberFromString.check(
          Schema.isBetween({ maximum: 12_000, minimum: 16 })
        ),
      })
    );
    const form = Form.instance(Preset, {
      id: "p",
      initialValues: { name: "", width: "100" },
    });
    expect(form.field("name").constraints).toEqual({
      maxlength: 40,
      minlength: 1,
      required: true,
    });
    expect(form.field("width").constraints).toEqual({ max: 12_000, min: 16 });
    expect(form.field("code").constraints).toEqual({});
    form.dispose();
  });
});

describe("unions", () => {
  const Model = Form.make(
    Schema.Struct({
      body: Schema.Union([
        Schema.Struct({
          dressSize: Schema.NonEmptyString,
          gender: Schema.Literal("Female"),
        }),
        Schema.Struct({
          chest: Schema.NonEmptyString,
          gender: Schema.Literal("Male"),
          waist: Schema.NonEmptyString,
        }),
      ]),
      name: Schema.NonEmptyString,
    })
  );

  test("only the active member's fields report errors", async () => {
    const form = Form.instance(Model, {
      id: "m",
      initialValues: { body: { dressSize: "", gender: "Female" }, name: "Ada" },
    });
    await form.submit();
    expect(form.errors.map((entry) => entry.path)).toEqual([
      ["body", "dressSize"],
    ]);
    form.field(["body", "gender"]).value = "Male";
    await tick();
    expect(form.errors.map((entry) => entry.path)).toEqual([
      ["body", "chest"],
      ["body", "waist"],
    ]);
    form.dispose();
  });
});

describe("registry", () => {
  test("an instance can live in a registry the caller passes", () => {
    const registry = AtomRegistry.make();
    const form = Form.instance(SignIn, {
      id: "x",
      initialValues: { email: "", password: "" },
      registry,
    });
    form.field("email").value = "a";
    expect(form.values.email).toBe("a");
    form.dispose();
  });
});

describe("more instance options", () => {
  const Settings = Form.make(Schema.Struct({ name: Schema.NonEmptyString }));

  test("autoSubmit submits each valid change, queuing the latest while one runs", async () => {
    const saved: string[] = [];
    const save = Atom.fn((input: { name: string }) =>
      Effect.sleep("10 millis").pipe(Effect.map(() => saved.push(input.name)))
    );
    const form = Form.instance(Settings, {
      autoSubmit: true,
      id: "a",
      initialValues: { name: "Ada" },
      submit: { atom: save },
    });
    await tick();
    expect(saved).toEqual([]);
    form.field("name").value = "Bo";
    await tick();
    form.field("name").value = "Bob";
    await tick();
    form.field("name").value = "";
    await tick();
    form.field("name").value = "Bobby";
    await sleep("60 millis");
    expect(saved).toEqual(["Bo", "Bobby"]);
    form.dispose();
  });

  test("values can live in an atom the caller owns", () => {
    const draft = Atom.make({ name: "Draft" });
    const registry = AtomRegistry.make();
    const form = Form.instance(Settings, {
      id: "v",
      initialValues: { name: "" },
      registry,
      values: draft,
    });
    expect(form.field("name").value).toBe("Draft");
    form.field("name").value = "Edited";
    expect(registry.get(draft)).toEqual({ name: "Edited" });
    expect(form.dirty).toBe(true);
    form.dispose();
  });

  test("a manual error clears when its field changes, and a form error on reset", () => {
    const form = Form.instance(Settings, {
      id: "m",
      initialValues: { name: "Ada" },
    });
    form.setErrors({ fields: { name: "Taken" }, form: "Try again" });
    expect(form.field("name").error).toBe("Taken");
    expect(form.rootError).toBe("Try again");
    expect(form.valid).toBe(false);
    form.field("name").value = "Bo";
    expect(form.field("name").error).toBeUndefined();
    expect(form.rootError).toBe("Try again");
    form.reset();
    expect(form.rootError).toBeUndefined();
    form.dispose();
  });

  test("resetOnSuccess goes back to the initial values but keeps the result", async () => {
    const save = Atom.fn((input: { name: string }) =>
      Effect.succeed(input.name)
    );
    const form = Form.instance(Settings, {
      id: "r",
      initialValues: { name: "" },
      resetOnSuccess: true,
      submit: { atom: save },
    });
    form.field("name").value = "New";
    await form.submit();
    expect(form.values.name).toBe("");
    expect(AsyncResult.isSuccess(form.submitResult)).toBe(true);
    expect(form.submitCount).toBe(0);
    form.dispose();
  });

  test("revertToLastSubmit and dirtySinceSubmit follow the last success", async () => {
    const save = Atom.fn((input: { name: string }) =>
      Effect.succeed(input.name)
    );
    const form = Form.instance(Settings, {
      id: "l",
      initialValues: { name: "Ada" },
      submit: { atom: save },
    });
    form.field("name").value = "Bo";
    await form.submit();
    form.field("name").value = "Cy";
    expect(form.dirtySinceSubmit).toBe(true);
    form.revertToLastSubmit();
    expect(form.values.name).toBe("Bo");
    expect(form.dirtySinceSubmit).toBe(false);
    form.dispose();
  });

  test("a group addresses the fields under a path", () => {
    const Address = Schema.Struct({
      city: Schema.String,
      street: Schema.String,
    });
    const Person = Form.make(
      Schema.Struct({ address: Address, name: Schema.String })
    );
    const form = Form.instance(Person, {
      id: "g",
      initialValues: { address: { city: "Paris", street: "" }, name: "" },
    });
    const address: Form.Group<{
      readonly street: string;
      readonly city: string;
    }> = form.at("address");
    expect(address.field("city").value).toBe("Paris");
    expect(address.field("city").id).toBe("g-address-city");
    form.dispose();
  });
});

describe("types", () => {
  test("paths are checked against the Schema, and autoSubmit needs a submit without args", () => {
    const form = signIn();
    // @ts-expect-error: no such field
    expect(() => form.field("emial")).not.toThrow();
    // @ts-expect-error: password is a string, not an object
    expect(() => form.field(["password", "length"])).not.toThrow();
    const save = Atom.fn((input: { id: number; email: string }) =>
      Effect.succeed(input.id)
    );
    // @ts-expect-error: autoSubmit can't supply submit's args
    const withArgs = Form.instance(SignIn, {
      autoSubmit: true,
      id: "t",
      initialValues: { email: "", password: "" },
      submit: {
        atom: save,
        payload: (decoded, id: number) => ({ email: decoded.email, id }),
      },
    });
    withArgs.dispose();
    form.dispose();
  });
});
