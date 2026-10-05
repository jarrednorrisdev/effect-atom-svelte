import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";

/** What each atom's hook saw in the browser, in order, by name (JND-85). */
export const revalidateSeen: Record<string, string[]> = {};

/** Which atoms were computed in the browser, so a test can tell a seed from a fetch. */
export const revalidateComputed: string[] = [];

export const resetRevalidate = (): void => {
  for (const name of Object.keys(revalidateSeen)) {
    Reflect.deleteProperty(revalidateSeen, name);
  }
  revalidateComputed.length = 0;
};

const describe = (result: AsyncResult.AsyncResult<string, never>): string =>
  result._tag === "Success"
    ? `${result.value}${result.waiting ? " (waiting)" : ""}`
    : result._tag;

export const record = (
  name: string,
  result: AsyncResult.AsyncResult<string, never>
): void => {
  const seen = revalidateSeen[name] ?? [];
  revalidateSeen[name] = seen;
  const entry = describe(result);
  if (seen.at(-1) !== entry) {
    seen.push(entry);
  }
};

/** A serializable atom that says where it ran. */
const whereAtom = (name: string) =>
  Atom.make(
    Effect.sync((): string => {
      if (typeof window === "undefined") {
        return "server";
      }
      revalidateComputed.push(name);
      return "browser";
    }).pipe(Effect.delay("50 millis"))
  ).pipe(
    Atom.serializable({
      key: `revalidate-${name}`,
      schema: AsyncResult.Schema({ success: Schema.String }),
    })
  );

export const resultAtom = whereAtom("result");
export const suspenseAtom = whereAtom("suspense");
export const keptAtom = whereAtom("kept");
export const afterAwaitAtom = whereAtom("after-await");
