// The examples' X-ray: outlines each component that provides a table's state, with a tag naming
// it. Not part of the examples' code; the providing component only attaches it.
import type { Attachment } from "svelte/attachments";

/** Whether the X-ray is on, for every example on the page. */
export const xray = $state({ on: false });

/** A mark color (outlines, dots) and a text color (tags) for a table, by its name. */
const colorOf = (
  name: string
): { readonly mark: string; readonly text: string } => {
  if (name === "Customers") {
    return {
      mark: "var(--color-sky-500)",
      text: "light-dark(var(--color-sky-700), var(--color-sky-400))",
    };
  }
  if (name.endsWith("items")) {
    return {
      mark: "var(--color-emerald-500)",
      text: "light-dark(var(--color-emerald-700), var(--color-emerald-400))",
    };
  }
  return { mark: "var(--brand)", text: "var(--brand-text)" };
};

const tag = (className: string, text: string, color: string) => {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  element.style.setProperty("--xray", color);
  element.setAttribute("aria-hidden", "true");
  return element;
};

/** On a component that calls Table.provide(): outlines it under the X-ray, tagged with its name. */
export const provides =
  (name: string): Attachment<HTMLElement> =>
  (element) => {
    // Always padded inside a transparent border, so turning the X-ray on only colors it.
    element.classList.add("xray-scope");
    if (!xray.on) {
      return () => element.classList.remove("xray-scope");
    }
    const { mark, text } = colorOf(name);
    element.classList.add("xray-provider");
    element.style.setProperty("--xray", mark);
    const label = tag("xray-tag", `${name}: Table.provide()`, text);
    element.append(label);
    return () => {
      element.classList.remove("xray-scope", "xray-provider");
      label.remove();
    };
  };
