/** The parts of a HAST node this plugin reads; mdsvex's own types are older than `@types/hast`. */
interface Node {
  children?: Node[];
  properties?: Record<string, unknown>;
  tagName?: string;
  type: string;
}

const linked = new Set(["h2", "h3"]);

const link = (node: Node) => {
  if (node.type === "element" && linked.has(node.tagName ?? "")) {
    const id = node.properties?.id;
    if (typeof id === "string") {
      node.children = [
        {
          children: node.children ?? [],
          properties: { className: ["heading-link"], href: `#${id}` },
          tagName: "a",
          type: "element",
        },
      ];
    }
    return;
  }
  for (const child of node.children ?? []) {
    link(child);
  }
};

/**
 * A rehype plugin that makes each h2 and h3 a link to itself, so a reader can copy a section's
 * address. It wraps the heading's text, so the heading's accessible name and the table of contents
 * stay the same; app.css shows a `#` beside it on hover and focus. Runs after rehype-slug, which
 * gives the headings their ids.
 */
export const headingLinks = () => (tree: Node) => {
  link(tree);
};

/**
 * A heading's id as rehype-slug (GitHub's rule) gives it, from its Markdown text: lowercase, with
 * punctuation dropped and spaces as hyphens. Repeats are not numbered here.
 */
export const headingId = (text: string) =>
  text
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replaceAll(/\s/gu, "-");
