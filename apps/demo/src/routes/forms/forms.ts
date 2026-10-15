import { TITLE_MAX_LENGTH } from "@demo/domain";
import { Schema } from "effect";
import { Form } from "effect-atom-svelte";

// Each Schema's encoded side is what the inputs hold, and its decoded side what a submit sends.

// The two passwords are one group, and the group's check compares them. Effect runs a struct's
// check once every field in that struct decodes, so here it waits only for the password, not for
// the email or the terms.
const NewPassword = Schema.Struct({
  confirm: Schema.String,
  value: Schema.String.check(
    Schema.isMinLength(8, { message: "At least 8 characters" })
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

export const SignUp = Form.make(
  Schema.Struct({
    email: Schema.String.check(
      Schema.isPattern(/^\S+@\S+\.\S+$/u, { message: "Enter an email address" })
    ),
    password: NewPassword,
    terms: Schema.Boolean.check(
      Schema.makeFilter((agreed) => agreed || "Agree to the terms to continue")
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
  Schema.decodeTo(Schema.FiniteFromString),
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

// One address, reused for billing and delivery: AddressFields edits either.
const Address = Schema.Struct({
  city: Schema.String.check(Schema.isNonEmpty({ message: "Enter a city" })),
  street: Schema.String.check(Schema.isNonEmpty({ message: "Enter a street" })),
});

// Delivery or pickup: a tagged union, so only the chosen option's fields are checked.
export const Checkout = Form.make(
  Schema.Struct({
    billing: Address,
    fulfilment: Schema.TaggedUnion({
      Delivery: { address: Address },
      Pickup: {
        store: Schema.Literals(["Soho", "Camden"]).pipe(
          Schema.annotateKey({ messageMissingKey: "Choose a store" })
        ),
      },
    }),
  })
);
