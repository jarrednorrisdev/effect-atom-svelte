// Stands in for SvelteKit's $app/navigation outside a SvelteKit app, so the module that imports it
// loads in unit tests. It records what it's given, so a test can drive the guard's listener and see
// its retries; the guard itself is tested end to end in the demo app.
export const recorded: {
  listeners: ((navigation: unknown) => void)[];
  gotos: { url: unknown; options: unknown }[];
} = { gotos: [], listeners: [] };

export const beforeNavigate = (
  listener: (navigation: unknown) => void
): void => {
  recorded.listeners.push(listener);
};

export const goto = (url: unknown, options?: unknown): Promise<void> => {
  recorded.gotos.push({ options, url });
  return Promise.resolve();
};
