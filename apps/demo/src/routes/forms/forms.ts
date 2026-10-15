import { TITLE_MAX_LENGTH } from "@demo/domain";
import { Schema } from "effect";
import { Form } from "effect-atom-svelte";

// Each Schema's encoded side is what the inputs hold, and its decoded side what a submit sends.

export const SignIn = Form.make(
  Schema.Struct({
    email: Schema.String.check(
      Schema.isPattern(/^\S+@\S+\.\S+$/u, { message: "Enter an email address" })
    ),
    password: Schema.String.check(
      Schema.isNonEmpty({ message: "Enter your password" })
    ),
  })
);

// Trim decodes "  Feed the cat " to "Feed the cat"; the checks run on the trimmed title.
export const RenameTodo = Form.make(
  Schema.Struct({
    title: Schema.Trim.check(
      Schema.isNonEmpty({ message: "Give the todo a title" }),
      Schema.isMaxLength(TITLE_MAX_LENGTH, {
        message: `Keep it to ${TITLE_MAX_LENGTH} characters`,
      })
    ),
  })
);

// A quantity is typed as text and decoded to a whole number of at least 1.
const Quantity = Schema.String.check(
  Schema.isNonEmpty({ message: "Enter a quantity" })
).pipe(
  Schema.decodeTo(Schema.NumberFromString),
  Schema.decodeTo(
    Schema.Int.check(
      Schema.isGreaterThanOrEqualTo(1, { message: "At least 1" })
    )
  )
);

export const Order = Form.make(
  Schema.Struct({
    items: Schema.Array(
      Schema.Struct({
        name: Schema.String.check(
          Schema.isNonEmpty({ message: "Name the item" })
        ),
        quantity: Quantity,
      })
    ).check(Schema.isMinLength(1, { message: "Add at least one item" })),
  })
);
