// Forms and submit atoms shared by the form fixtures.
import { Effect, Schema } from "effect";
import { Atom } from "effect/reactivity";

import { Form } from "../../src/index.ts";

export class WrongPassword extends Schema.TaggedError<WrongPassword>()(
  "WrongPassword",
  { email: Schema.String }
) {}

export const SignIn = Form.make(
  Schema.Struct({
    email: Schema.String.check(
      Schema.isPattern(/^\S+@\S+$/u, { message: "Enter a valid email" })
    ),
    password: Schema.String.check(
      Schema.isNonEmpty({ message: "Enter your password" })
    ),
  })
);

export const signInAtom = Atom.fn(
  (input: { email: string; password: string }) =>
    input.password === "wrong"
      ? Effect.fail(new WrongPassword({ email: input.email }))
      : Effect.succeed(input.email)
);

export const Rename = Form.make(Schema.Struct({ title: Schema.String }));

/** Saves slowly, so a test can close the form while it runs. The log records each save. */
export const makeSlowSave = (log: string[]) =>
  Atom.fn((input: { title: string }) =>
    Effect.sleep("60 millis").pipe(
      Effect.map(() => {
        log.push(`saved ${input.title}`);
        return input.title;
      })
    )
  );

/** An address whose Schema puts city first, which the fixture lays out street first, as checkout does. */
export const Billing = Form.make(
  Schema.Struct({
    city: Schema.String.check(Schema.isNonEmpty({ message: "Enter a city" })),
    street: Schema.String.check(
      Schema.isNonEmpty({ message: "Enter a street" })
    ),
  })
);
