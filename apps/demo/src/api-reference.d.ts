/** The library's API reference, read from its source by the `api-reference` plugin in `vite/api-reference.ts`. */
declare module "virtual:api-reference" {
  // oxlint-disable-next-line typescript/consistent-type-imports -- an ambient module can't import a relative path, and a top-level import would make this file a module augmentation
  export const modules: readonly import("../vite/api-reference.ts").ApiModuleHtml[];
  /** Each module's page as Markdown, without its title. */
  export const markdown: readonly { href: string; text: string }[];
}
