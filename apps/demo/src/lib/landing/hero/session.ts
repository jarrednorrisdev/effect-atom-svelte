import { Data, Effect } from "effect";

// Stands in for your own session code; the hero shows only user.ts and user-badge.svelte.
export interface User {
  readonly name: string;
}

export class SignedOut extends Data.TaggedError("SignedOut") {}

export const currentUser: Effect.Effect<User, SignedOut> = Effect.succeed({
  name: "Ada",
});
