import { Schema } from "effect";

/** The only token `GET /api/me` accepts, sent as `Authorization: Bearer demo-token`. */
export const DEMO_TOKEN = "demo-token";

export class Account extends Schema.Class<Account>("Account")({
  name: Schema.String,
}) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  { message: Schema.String },
  { httpApiStatus: 401 }
) {}
