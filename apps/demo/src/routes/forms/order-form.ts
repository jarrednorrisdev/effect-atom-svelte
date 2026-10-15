import { Schema } from "effect";
import { Form } from "effect-atom-svelte";

// A quantity is typed as text and decoded to a whole number
// of at least 1. FiniteFromString fails on "abc", where
// NumberFromString would give NaN.
const Quantity = Schema.String.check(
  Schema.isNonEmpty({ message: "Enter a quantity" })
).pipe(
  Schema.decodeTo(Schema.FiniteFromString),
  Schema.decodeTo(
    Schema.Int.check(
      Schema.isGreaterThanOrEqualTo(1, {
        message: "At least 1",
      })
    )
  )
);

const Item = Schema.Struct({
  name: Schema.String.check(
    Schema.isNonEmpty({
      message: "Name the item",
    })
  ),
  quantity: Quantity,
});

export const Order = Form.make(
  Schema.Struct({
    items: Schema.Array(Item).check(
      Schema.isMinLength(1, {
        message: "Add at least one item",
      })
    ),
  })
);
