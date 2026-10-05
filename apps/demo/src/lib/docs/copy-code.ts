/**
 * The copy buttons on code blocks. `vite/highlight.ts` renders them into static HTML, so one
 * listener on the document handles every block, including those in the API reference and in
 * `<Example>`.
 */

const copiedFor = 2000;

/**
 * Screen readers don't announce a change to the focused button's label, so the outcome is also
 * spoken from a polite live region, made on first use.
 */
const announce = (message: string) => {
  let region = document.querySelector<HTMLElement>("[data-copy-code-status]");
  if (!region) {
    region = document.createElement("div");
    region.className = "sr-only";
    region.dataset.copyCodeStatus = "";
    region.role = "status";
    document.body.append(region);
  }
  // Emptied first, so copying the same block twice is announced twice.
  region.textContent = "";
  const target = region;
  setTimeout(() => {
    target.textContent = message;
  }, 50);
};

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
  try {
    // Line numbers are CSS counters, so the text is just the code.
    await navigator.clipboard.writeText(code.textContent ?? "");
  } catch {
    // No clipboard access: an insecure page, or the browser refused.
    announce("Couldn't copy the code");
    return;
  }
  button.toggleAttribute("data-copied", true);
  button.ariaLabel = "Copied";
  announce("Copied");
  setTimeout(() => {
    delete button.dataset.copied;
    button.ariaLabel = "Copy code";
  }, copiedFor);
};
