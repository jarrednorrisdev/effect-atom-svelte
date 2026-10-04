import { Exit } from "effect";
import { useAtomSet, useAtomValue } from "effect-atom-svelte";

import { TodosRpc } from "#lib/clients.ts";

import { todosAtom } from "./todos.ts";

const createAtom = TodosRpc.mutation("createTodo");

// A form's state and actions. The hooks run in the constructor, so a
// component must create it while it initializes.
export class TodoForm {
  title = $state("");
  readonly todos = useAtomValue(todosAtom);
  readonly saving = useAtomValue(createAtom);
  readonly #create = useAtomSet(createAtom, { mode: "promiseExit" });

  submit = async () => {
    const exit = await this.#create({
      payload: { title: this.title },
      reactivityKeys: ["todos"],
    });
    if (Exit.isSuccess(exit)) {
      this.title = "";
    }
  };
}
