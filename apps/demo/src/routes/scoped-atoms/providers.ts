import type { Atom } from "effect/reactivity";

// For the examples' labels and colors only: which editor provided an atom, looked
// up by the atom itself, so a part shows the provider Draft.use() really found.
const names = new WeakMap<Atom.Atom<string>, string>();

/** A mark color (borders) and a text color (labels) for each provider. */
export interface ProviderColor {
  readonly mark: string;
  readonly text: string;
}

const amber: ProviderColor = {
  mark: "var(--brand)",
  text: "var(--brand-text)",
};
const sky: ProviderColor = {
  mark: "var(--color-sky-500)",
  text: "light-dark(var(--color-sky-700), var(--color-sky-400))",
};
const violet: ProviderColor = {
  mark: "var(--color-violet-500)",
  text: "light-dark(var(--color-violet-700), var(--color-violet-400))",
};
const colors: Readonly<Record<string, ProviderColor>> = {
  Editors: violet,
  "Note A": amber,
  "Note B": sky,
  Post: amber,
  Reply: sky,
};

export const nameProvider = (atom: Atom.Atom<string>, name: string) => {
  names.set(atom, name);
};

export const providerOf = (atom: Atom.Atom<string>) => names.get(atom) ?? "?";

export const colorOf = (atom: Atom.Atom<string>): ProviderColor =>
  colors[providerOf(atom)] ?? amber;
