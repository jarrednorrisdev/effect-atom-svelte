/**
 * What to reach for in a Svelte app with an Effect backend: runes for a component's own concerns,
 * atoms for the app's state. The landing page's hero and the Why atoms page both show it, through
 * `atoms-guide.svelte`, and `vite/llms.ts` writes it as a Markdown table. `atoms` marks the rows
 * where the tool is an atom.
 */
export const guide: readonly {
  readonly atoms: boolean;
  readonly need: string;
  readonly tool: string;
  readonly why: string;
}[] = [
  {
    atoms: false,
    need: "State one component owns (a draft, an open menu)",
    tool: "$state",
    why: "in that component",
  },
  {
    atoms: false,
    need: "A value computed just for one component's display (a formatted total, a label)",
    tool: "$derived",
    why: "in that component, from its props, state or the atoms it reads",
  },
  {
    atoms: true,
    need: "State shared across components or parts of your app (the signed-in user, a cart, a filter)",
    tool: "An atom in a plain module",
    why: "any component imports it, with no context to set up; one provider gives each request its own values",
  },
  {
    atoms: true,
    need: "Data from your Effect backend",
    tool: "A query atom",
    why: "typed by the server's schemas, and shared like any atom",
  },
  {
    atoms: true,
    need: "Writing to your backend (create, update, delete)",
    tool: "A mutation atom with reactivity keys",
    why: "the queries it affects refetch, and everything derived from them follows",
  },
  {
    atoms: true,
    need: "A value computed from other atoms (an open count, a filtered list)",
    tool: "A derived atom",
    why: "it follows whatever it reads, backend data or shared state",
  },
  {
    atoms: true,
    need: "Live data (a feed, a socket)",
    tool: "A stream atom",
    why: "it starts when read, and stops when nothing reads it",
  },
  {
    atoms: true,
    need: "Failures your UI must handle",
    tool: "An atom's AsyncResult",
    why: "the error is typed by the effect, and matched as a value",
  },
];

/** The caption both pages show above the guide. */
export const guideCaption = "In a Svelte app with an Effect backend";
