// Form instances without Svelte: values, validation timing, submit and arrays.
import { Cause, Data, Effect, Exit, Option, Schema } from "effect";
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
    expect(first?.fields.field("name").id).toBe(`o-items-_${first?.key}-name`);
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

/** A promise, or "timed out" if it hasn't settled after 200 milliseconds. */
const settled = <A>(promise: Promise<A>) =>
  Promise.race([promise, sleep("200 millis").then(() => "timed out" as const)]);

describe("found in review", () => {
  const Settings = Form.make(Schema.Struct({ name: Schema.NonEmptyString }));

  test("a submit within the debounce settles", async () => {
    const Debounced = Form.make(
      Schema.Struct({ name: Schema.NonEmptyString }),
      {
        debounce: "50 millis",
      }
    );
    const form = Form.instance(Debounced, {
      id: "a",
      initialValues: { name: "Ada" },
    });
    await sleep("80 millis");
    form.field("name").value = "Bo";
    expect(await settled(form.submit())).toEqual(Exit.succeed({ name: "Bo" }));
    form.field("name").value = "Cy";
    expect(await settled(form.validate())).toBe(true);
    form.dispose();
  });

  test("a validation that can't run ends the submit with its cause", async () => {
    const Throws = Form.make(
      Schema.Struct({
        name: Schema.String.check(
          Schema.makeFilter((name: string) => {
            if (name === "boom") {
              throw new Error("boom");
            }
            return true;
          })
        ),
      })
    );
    const form = Form.instance(Throws, {
      id: "c",
      initialValues: { name: "boom" },
    });
    const errors: unknown[] = [];
    const { error } = console;
    console.error = (...args: unknown[]) => errors.push(args);
    try {
      await tick();
      const exit = await settled(form.submit());
      expect(exit !== "timed out" && Exit.isFailure(exit)).toBe(true);
      expect(form.valid).toBe(false);
    } finally {
      console.error = error;
    }
    // The first run, and the run submit tries again.
    expect(errors).toHaveLength(2);
    form.dispose();
  });

  test("a write during a submit isn't recorded as submitted", async () => {
    const sent: string[] = [];
    const save = Atom.fn((input: { name: string }) =>
      Effect.sync(() => sent.push(input.name))
    );
    const form = Form.instance(Settings, {
      id: "b",
      initialValues: { name: "Ada" },
      submit: { atom: save },
    });
    form.field("name").value = "Bo";
    await tick();
    const pending = form.submit();
    form.setValues({ name: "" });
    await pending;
    expect(sent).toEqual(["Bo"]);
    expect(Option.getOrThrow(form.lastSubmitted).encoded.name).toBe("Bo");
    expect(form.dirty).toBe(true);
    form.dispose();
  });

  test("resetOnSuccess goes back to the latest initial values", async () => {
    const save = Atom.fn((input: { name: string }) =>
      Effect.succeed(input.name)
    );
    const form = Form.instance(Settings, {
      id: "d",
      initialValues: { name: "Loading" },
      resetOnSuccess: true,
      submit: { atom: save },
    });
    form.reset({ name: "Loaded" });
    form.field("name").value = "Edited";
    await form.submit();
    expect(form.values.name).toBe("Loaded");
    form.dispose();
  });

  test("autoSubmit with resetOnSuccess doesn't submit the reset values", async () => {
    const sent: string[] = [];
    const save = Atom.fn((input: { name: string }) =>
      Effect.sync(() => sent.push(input.name))
    );
    const form = Form.instance(Settings, {
      autoSubmit: true,
      id: "e",
      initialValues: { name: "Ada" },
      resetOnSuccess: true,
      submit: { atom: save },
    });
    await tick();
    form.field("name").value = "Bo";
    await sleep("30 millis");
    expect(sent).toEqual(["Bo"]);
    form.dispose();
  });

  test("ids differ for keys that look alike", () => {
    const Keys = Form.make(
      Schema.Struct({
        a: Schema.Struct({ b: Schema.String }),
        "a-b": Schema.String,
        "a.b": Schema.String,
        a_b: Schema.String,
      })
    );
    const form = Form.instance(Keys, {
      id: "g",
      initialValues: { a: { b: "" }, "a-b": "", "a.b": "", a_b: "" },
    });
    const ids = [
      form.field(["a", "b"]).id,
      form.field("a-b").id,
      form.field("a.b").id,
      form.field("a_b").id,
    ];
    expect(new Set(ids).size).toBe(4);
    expect(ids[0]).toBe("g-a-b");
    form.dispose();
  });

  test("submit and validate after dispose don't hang", async () => {
    const form = Form.instance(Settings, {
      id: "h",
      initialValues: { name: "" },
    });
    form.dispose();
    expect(await settled(form.validate())).not.toBe("timed out");
    expect(await settled(form.submit())).not.toBe("timed out");
  });

  test("a field under an optional parent may be undefined", () => {
    const WithOptional = Form.make(
      Schema.Struct({
        address: Schema.optional(Schema.Struct({ city: Schema.String })),
      })
    );
    const form = Form.instance(WithOptional, { id: "o", initialValues: {} });
    const city: string | undefined = form.field(["address", "city"]).value;
    // @ts-expect-error: undefined while there is no address
    const notString: string = form.field(["address", "city"]).value;
    expect([city, notString]).toEqual([undefined, undefined]);
    form.dispose();
  });
});

/** A form whose check throws the first time it runs, and counts its runs. */
const throwsOnce = () => {
  let calls = 0;
  const form = Form.make(
    Schema.Struct({
      name: Schema.String.check(
        Schema.makeFilter(() => {
          calls += 1;
          if (calls === 1) {
            throw new Error("blip");
          }
          return true;
        })
      ),
    })
  );
  return { calls: () => calls, form };
};
const quiet = async <A>(f: () => Promise<A>): Promise<A> => {
  const { error } = console;
  console.error = () => undefined;
  try {
    return await f();
  } finally {
    console.error = error;
  }
};

describe("found in review, round 1", () => {
  test("a validation that couldn't run is run again by submit, and its cause is in submitResult", async () => {
    const blip = throwsOnce();
    const save = Atom.fn((input: { name: string }) =>
      Effect.succeed(input.name)
    );
    const form = Form.instance(blip.form, {
      id: "r1",
      initialValues: { name: "Ada" },
      submit: { atom: save },
    });
    await quiet(tick);
    expect(form.valid).toBe(false);
    const exit = await settled(form.submit());
    expect(exit).toEqual(Exit.succeed("Ada"));
    expect(blip.calls()).toBe(2);
    form.dispose();
  });

  test("a submit whose validation fails again reports the cause in submitResult", async () => {
    const Always = Form.make(
      Schema.Struct({
        name: Schema.String.check(
          Schema.makeFilter(() => {
            throw new Error("down");
          })
        ),
      })
    );
    const form = Form.instance(Always, {
      id: "r2",
      initialValues: { name: "Ada" },
    });
    const exit = await quiet(() => settled(form.submit()));
    expect(exit !== "timed out" && Exit.isFailure(exit)).toBe(true);
    expect(AsyncResult.isFailure(form.submitResult)).toBe(true);
    // A defect: the runtime's error isn't in the submit's error type.
    expect(
      AsyncResult.isFailure(form.submitResult) &&
        Cause.hasDies(form.submitResult.cause)
    ).toBe(true);
    form.dispose();
  });

  test("validate is false while the decode can't run", async () => {
    const Always = Form.make(
      Schema.Struct({
        name: Schema.String.check(
          Schema.makeFilter(() => {
            throw new Error("down");
          })
        ),
      })
    );
    const form = Form.instance(Always, {
      id: "r3",
      initialValues: { name: "Ada" },
    });
    expect(await quiet(() => form.validate())).toBe(false);
    expect(await quiet(() => form.validate(["name"]))).toBe(false);
    form.dispose();
  });

  test("a form error from setErrors clears at the next submit", async () => {
    const form = Form.instance(
      Form.make(Schema.Struct({ name: Schema.String })),
      {
        id: "r4",
        initialValues: { name: "Ada" },
      }
    );
    form.setErrors({ form: "Server is down" });
    expect(form.rootError).toBe("Server is down");
    await form.submit();
    expect(form.rootError).toBeUndefined();
    expect(form.valid).toBe(true);
    form.dispose();
  });

  test("only an anchored pattern becomes an HTML pattern, and isBetweenLength sets both lengths", () => {
    const Codes = Form.make(
      Schema.Struct({
        anchored: Schema.String.check(Schema.isPattern(/^[A-Z]{3}$/u)),
        anywhere: Schema.String.check(Schema.isPattern(/\d/u)),
        either: Schema.String.check(Schema.isPattern(/^a|b$/u)),
        title: Schema.String.check(Schema.isBetweenLength(1, 80)),
      })
    );
    const form = Form.instance(Codes, {
      id: "r5",
      initialValues: { anchored: "", anywhere: "", either: "", title: "" },
    });
    expect(form.field("anchored").constraints).toEqual({
      pattern: "^[A-Z]{3}$",
    });
    expect(form.field("anywhere").constraints).toEqual({});
    expect(form.field("either").constraints).toEqual({});
    expect(form.field("title").constraints).toEqual({
      maxlength: 80,
      minlength: 1,
      required: true,
    });
    form.dispose();
  });
});
