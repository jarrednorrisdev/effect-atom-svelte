import { error } from "@sveltejs/kit";
import { modules } from "virtual:api-reference";

import type { PageServerLoad } from "./$types";

// Built from the library's source, so it is prerendered and indexed for search.
export const prerender = true;

export const load: PageServerLoad = () => {
  const module = modules.find((entry) => entry.href === "/reference");
  if (!module) {
    error(404, "No API reference for the index");
  }
  return { module };
};
