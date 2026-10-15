import { TITLE_MAX_LENGTH } from "@demo/domain";
import { Schema } from "effect";
import { Form } from "effect-atom-svelte";

// Trim decodes "  Feed the cat " to "Feed the cat"; the
// checks run on the trimmed title.
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
