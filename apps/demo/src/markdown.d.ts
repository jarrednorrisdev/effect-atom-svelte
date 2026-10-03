/** A markdown page compiled to a Svelte component by mdsvex (`vite.config.ts`). */
declare module "*.md" {
  import type { Component } from "svelte";

  const component: Component;
  export default component;
}
