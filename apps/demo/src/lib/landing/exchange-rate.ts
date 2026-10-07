import { Effect } from "effect";
import { Atom } from "effect/reactivity";

import { runs } from "./rate-log.ts";

// Your Effect code: a slow lookup, here of a made-up exchange rate.
const fetchRate = Effect.gen(function* fetchRate() {
  runs.add("effect started", { tone: "running" });
  yield* Effect.sleep("1 second");
  const rate = (1.05 + Math.random() / 10).toFixed(4);
  runs.add(`effect returned ${rate}`, { tone: "success" });
  return rate;
});

// Defined once, in a plain module: every reader shares one run.
export const rateAtom = Atom.make(fetchRate);
