/** The guide pages as Markdown, from the `llms` plugin in `vite/llms.ts`. */
declare module "virtual:llms" {
  import type { LlmsPage } from "../vite/llms.ts";

  export const pages: readonly LlmsPage[];
}
