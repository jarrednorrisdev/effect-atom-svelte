/**
 * The copy buttons on code blocks. `vite/highlight.ts` renders them into static HTML, so one
 * listener on the document handles every block, including those in the API reference and in
 * `<Example>`.
 */

const copiedFor = 2000;

/** Copies a block's code when its copy button is clicked; ignores every other click. */
export const copyCode = async (event: MouseEvent) => {
  if (!(event.target instanceof Element)) {
    return;
  }
  const button = event.target.closest<HTMLButtonElement>("[data-copy-code]");
  const code = button?.parentElement?.querySelector("pre code");
  if (!button || !code) {
    return;
  }
  // Line numbers are CSS counters, so the text is just the code.
  await navigator.clipboard.writeText(code.textContent ?? "");
  button.toggleAttribute("data-copied", true);
  button.ariaLabel = "Copied";
  setTimeout(() => {
    delete button.dataset.copied;
    button.ariaLabel = "Copy code";
  }, copiedFor);
};
