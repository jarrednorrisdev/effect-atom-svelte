import { error } from "@sveltejs/kit";
import { modules } from "virtual:api-reference";

import type { EntryGenerator, PageServerLoad } from "./$types";

// Built from the library's source, so it is prerendered and indexed for search.
export const prerender = true;

export const entries: EntryGenerator = () =>
  modules
    .filter((module) => module.href !== "/reference")
    .map((module) => ({ module: module.name }));

export const load: PageServerLoad = ({ params }) => {
  const module = modules.find(
    (entry) => entry.href === `/reference/${params.module}`
  );
  if (!module) {
    error(404, `No API reference for ${params.module}`);
  }
  return { module };
};
