/** The library's API reference, read from its source by the `api-reference` plugin in `vite/api-reference.ts`. */
declare module "virtual:api-reference" {
  import type { ApiModuleHtml } from "../vite/api-reference.ts";

  export const modules: readonly ApiModuleHtml[];
}
