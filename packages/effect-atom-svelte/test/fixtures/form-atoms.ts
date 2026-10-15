// Forms and submit atoms shared by the form fixtures.
import { Data, Effect, Schema } from "effect";
import { Atom } from "effect/reactivity";

import { Form } from "../../src/index.ts";

export class WrongPassword extends Data.TaggedError("WrongPassword")<{
  readonly email: string;
}> {}

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
