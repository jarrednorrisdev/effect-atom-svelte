// Ambient declaration (no imports or exports) so it extends SvelteKit's global App namespace.
declare namespace App {
  // oxlint-disable-next-line eslint/no-redeclare -- augments SvelteKit's App.Error, not the global Error
  interface Error {
    tag?: string | undefined;
  }
}
