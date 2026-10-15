// Stands in for SvelteKit's $app/navigation outside a SvelteKit app, so the module that imports it
// loads in unit tests. The guard itself is tested end to end in the demo app.
export const beforeNavigate = (_callback: unknown): void => undefined;
export const goto = (_url: unknown, _options?: unknown): Promise<void> =>
  Promise.resolve();
