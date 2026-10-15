import { Schema } from "effect";
import { Form } from "effect-atom-svelte";

// Each Schema's encoded side is what the inputs hold, and its
// decoded side what a submit sends.

const Email = Schema.String.check(
  Schema.isPattern(/^\S+@\S+\.\S+$/u, {
    message: "Enter an email address",
  })
);

// The two passwords are one group, and the group's check
// compares them. Effect runs a struct's check once every
// field in that struct decodes, so here it waits only for
// the password, not for the email or the terms.
const NewPassword = Schema.Struct({
  confirm: Schema.String,
  value: Schema.String.check(
    Schema.isMinLength(8, {
      message: "At least 8 characters",
    })
  ),
}).check(
  Schema.makeFilter(
    ({ confirm, value }) =>
      confirm === value || {
        issue: "Passwords do not match",
        path: ["confirm"],
      }
  )
);

const Terms = Schema.Boolean.check(
  Schema.makeFilter((agreed) => agreed || "Accept the terms")
);

export const SignUp = Form.make(
  Schema.Struct({
    email: Email,
    password: NewPassword,
    terms: Terms,
  })
);
