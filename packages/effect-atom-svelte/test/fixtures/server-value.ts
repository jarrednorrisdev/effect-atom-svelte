import { Effect, Schema } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";

/** Which atoms were computed in this environment, so a test can tell where each ran. */
export const serverValueComputed: string[] = [];

const browserOnly = (name: string) =>
  Atom.make(
    Effect.sync(() => {
      serverValueComputed.push(name);
      if (typeof window === "undefined") {
        throw new TypeError(`${name} computed on the server`);
      }
      return `${name} from the browser`;
    })
  ).pipe(
    Atom.serializable({
      key: `server-value-${name}`,
      schema: AsyncResult.Schema({ success: Schema.String }),
    })
  );

export const pendingOnServer = browserOnly("result").pipe(
  Atom.withServerValueInitial
);

export const valueOnServer = browserOnly("suspense").pipe(
  Atom.withServerValue(() => AsyncResult.success("suspense from the server"))
);
