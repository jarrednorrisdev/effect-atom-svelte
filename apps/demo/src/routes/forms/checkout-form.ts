import { Schema } from "effect";
import { Form } from "effect-atom-svelte";

// One address, reused for billing and delivery: AddressFields
// edits either.
const Address = Schema.Struct({
  city: Schema.String.check(
    Schema.isNonEmpty({
      message: "Enter a city",
    })
  ),
  street: Schema.String.check(
    Schema.isNonEmpty({
      message: "Enter a street",
    })
  ),
});

const Store = Schema.Literals(["Soho", "Camden"]).pipe(
  Schema.annotateKey({ messageMissingKey: "Choose a store" })
);

// Delivery or pickup: a tagged union, so only the chosen
// option's fields are checked.
export const Checkout = Form.make(
  Schema.Struct({
    billing: Address,
    fulfilment: Schema.TaggedUnion({
      Delivery: { address: Address },
      Pickup: { store: Store },
    }),
  })
);
