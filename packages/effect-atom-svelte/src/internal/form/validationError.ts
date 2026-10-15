// The failure a form's submit reports when its values don't decode. Internal: `Form.ts` exports it.
import { Data } from "effect";

import type { IndexPath } from "./paths.ts";

/** A form's validation failure, as `submit` reports it. */
export class FormValidationError extends Data.TaggedError(
  "FormValidationError"
)<{
  readonly errors: readonly {
    readonly path: IndexPath;
    readonly message: string;
  }[];
}> {}
