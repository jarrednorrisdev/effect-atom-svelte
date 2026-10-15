/** The guide pages as Markdown, from the `llms` plugin in `vite/llms.ts`. */
declare module "virtual:llms" {
  // oxlint-disable-next-line typescript/consistent-type-imports -- an ambient module can't import a relative path, and a top-level import would make this file a module augmentation
  export const pages: readonly import("../vite/llms.ts").LlmsPage[];
}
