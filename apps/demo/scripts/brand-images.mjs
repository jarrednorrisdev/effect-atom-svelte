// Draws the site's icons and link-preview image into static/, from the logo in the header
// (src/lib/docs/site-logo.svelte), the site's fonts and its dark theme's colours:
//
// - favicon.svg: the logo's three marks on one centre (the component's square, the atom's ring,
//   the Effect's diamond), on the dark background.
// - favicon.ico (16 and 32 px) and apple-touch-icon.png (180 px), rendered from it.
// - og-image.png (1200 x 630): the image Discord, Slack and the rest show for a link to the site,
//   ruled in hairlines like the landing page, with the logo, the tagline and a small graph.
//
// Run it from apps/demo after changing the logo or the colours: `node scripts/brand-images.mjs`.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const at = (path) => fileURLToPath(new URL(path, import.meta.url));
const statics = (name) => at(`../static/${name}`);

// The dark theme's tokens (src/app.css, .dark), as the hex colours they round to.
const color = {
  background: "#09090b",
  border: "#27272a",
  brand: "#f59e0b",
  cross: "#8d8d92",
  foreground: "#fafafa",
  muted: "#a1a1aa",
  subtle: "#71717a",
};

const font = (file) =>
  `data:font/woff2;base64,${readFileSync(at(file)).toString("base64")}`;
const fonts = `
  @font-face { font-family: Geist; src: url(${font("../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2")}); font-weight: 100 900; }
  @font-face { font-family: Mono; src: url(${font("../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2")}); font-weight: 100 800; }
  @font-face { font-family: Libron; font-style: italic; src: url(${font("../src/lib/fonts/libron/Libron-Italic.woff2")}); }
`;

// The square, the ring and the diamond on one centre, as the logo draws them one after another.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${color.background}"/><rect x="6.75" y="6.75" width="18.5" height="18.5" rx="2" fill="none" stroke="${color.muted}" stroke-width="1.5"/><circle cx="16" cy="16" r="6.25" fill="${color.background}" stroke="${color.brand}" stroke-width="2.5"/><rect x="13.25" y="13.25" width="5.5" height="5.5" fill="${color.foreground}" transform="rotate(45 16 16)"/></svg>`;

// The logo's mark in a row, as the header draws it, `scale` times its 11 px height.
const mark = (scale) => {
  const px = (n) => `${n * scale}px`;
  return `<span style="display:inline-flex;align-items:center;height:${px(11)}">
    <i style="display:block;width:${px(7)};height:${px(7)};margin:0 ${px(1)};background:${color.foreground};rotate:45deg"></i>
    <i style="display:block;width:${px(7)};height:${px(1)};background:${color.muted}"></i>
    <i style="display:block;box-sizing:border-box;width:${px(11)};height:${px(11)};border:${px(2)} solid ${color.brand};border-radius:50%"></i>
    <i style="display:block;width:${px(7)};height:${px(1)};background:${color.muted}"></i>
    <i style="display:block;box-sizing:border-box;width:${px(9)};height:${px(9)};border:${px(1)} solid ${color.muted};border-radius:${px(1.5)}"></i>
  </span>`;
};

// A cross on a 1px line's pixel at (x, y), its arms 1px lines 25px long.
const cross = (x, y) => `<i class="cross" style="left:${x}px;top:${y}px"></i>`;

// A node of the graph on the line at y, with its label and note above it, as the hero draws them.
const node = (kind, x, y, label, note, align = "left") => `
  <i class="node ${kind}" style="left:${x}px;top:${y}px"></i>
  <span class="label" style="${align === "left" ? `left:${x + 18}px` : `right:${1200 - x + 18}px;text-align:right`};top:${y - 52}px">${label}<em>${note}</em></span>`;

const og = () => {
  const left = 64;
  const right = 1136;
  const top = 64;
  const line = 446;
  const bottom = 566;
  return `<!doctype html><html><head><style>
  ${fonts}
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: ${color.background}; color: ${color.foreground}; font-family: Geist; position: relative; overflow: hidden; }
  .h, .v { position: absolute; background: ${color.border}; }
  .h { left: 0; right: 0; height: 1px; }
  .v { top: 0; bottom: 0; width: 1px; }
  .cross { position: absolute; width: 1px; height: 1px; }
  .cross::before, .cross::after { content: ""; position: absolute; background: ${color.cross}; }
  .cross::before { left: -12px; top: 0; width: 25px; height: 1px; }
  .cross::after { left: 0; top: -12px; width: 1px; height: 25px; }
  .mono { font-family: Mono; }
  .tag { position: absolute; font-family: Mono; font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase; color: ${color.muted}; }
  .tag b { color: ${color.brand}; font-weight: 400; margin-right: 14px; }
  .node { position: absolute; display: block; translate: -50% -50%; margin: 0.5px 0 0 0.5px; }
  .node.effect { width: 13px; height: 13px; background: ${color.foreground}; rotate: 45deg; }
  .node.atom { width: 21px; height: 21px; border: 4px solid ${color.brand}; border-radius: 50%; background: ${color.background}; box-shadow: 0 0 0 6px ${color.background}; }
  .node.component { width: 17px; height: 17px; border: 2px solid ${color.foreground}; border-radius: 3px; background: ${color.background}; }
  .label { position: absolute; font-family: Mono; font-size: 17px; font-weight: 600; white-space: nowrap; }
  .label em { display: block; font-family: Libron; font-weight: 400; font-size: 17px; color: ${color.muted}; margin-top: 2px; }
  .lit { position: absolute; height: 1px; background: ${color.brand}; }
  </style></head><body>
    <i class="h" style="top:${top}px"></i>
    <i class="h" style="top:${line}px"></i>
    <i class="h" style="top:${bottom}px"></i>
    <i class="v" style="left:${left}px"></i>
    <i class="v" style="left:${right}px"></i>
    <i class="v" style="left:600px;top:${line}px;bottom:${630 - bottom}px"></i>
    ${[top, line, bottom].flatMap((y) => [cross(left, y), cross(right, y)]).join("")}
    ${cross(600, line)}${cross(600, bottom)}

    <span class="tag" style="left:${left + 24}px;top:${top - 40}px"><b>A</b>One Effect → one atom → every component that reads it</span>

    <div style="position:absolute;left:${left + 56}px;top:${top + 62}px;display:flex;align-items:center;gap:22px">
      ${mark(3.4)}
      <span class="mono" style="font-size:44px;font-weight:600;letter-spacing:-0.02em">effect-<span style="color:${color.brand}">atom</span><span style="color:${color.muted}">-svelte</span></span>
    </div>
    <div class="mono" style="position:absolute;left:${left + 56}px;top:${top + 150}px;font-size:46px;font-weight:600;line-height:1.18;letter-spacing:-0.03em">
      Write it in Effect.<br><span style="color:${color.brand}">Read it in any component.</span>
    </div>

    <i class="lit" style="left:${left}px;width:${520 - left}px;top:${line}px"></i>
    ${node("effect", left, line, "fetchUser", "an Effect&lt;User&gt;")}
    ${node("atom", 520, line, "userAtom", "runs it once")}
    ${node("component", 760, line, "Header.svelte", "reads it")}
    ${node("component", right, line, "Profile.svelte", "reads it too", "right")}

    <span class="tag" style="left:${left + 24}px;top:${line + 50}px">Svelte 5 · Effect Atom · SvelteKit · devtools</span>
    <span class="tag" style="left:${600 + 24}px;top:${line + 50}px;color:${color.foreground}"><b>→</b>atom.jarrednorris.dev</span>
    <span class="tag" style="left:${left + 24}px;top:${bottom + 26}px;color:${color.subtle}">Community project · not made by the Effect team</span>
  </body></html>`;
};

/** An ICO file holding PNGs, which every browser since 2007 reads. */
const ico = (pngs) => {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  for (const [index, { data, size }] of pngs.entries()) {
    const entry = 6 + 16 * index;
    header.writeUInt8(size % 256, entry);
    header.writeUInt8(size % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  }
  return Buffer.concat([header, ...pngs.map(({ data }) => data)]);
};

const browser = await chromium.launch();
const render = async (html, width, height) => {
  const page = await browser.newPage({ viewport: { height, width } });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ omitBackground: true });
  await page.close();
  return png;
};
const icon = (size, rounded = true) =>
  render(
    `<body style="margin:0">${(rounded ? favicon : favicon.replace('rx="7"', 'rx="0"')).replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`,
    size,
    size
  );

writeFileSync(statics("favicon.svg"), `${favicon}\n`);
writeFileSync(
  statics("favicon.ico"),
  ico([
    { data: await icon(16), size: 16 },
    { data: await icon(32), size: 32 },
  ])
);
// iOS rounds the corners itself, so the touch icon is square.
writeFileSync(statics("apple-touch-icon.png"), await icon(180, false));
writeFileSync(statics("og-image.png"), await render(og(), 1200, 630));
await browser.close();
console.log(
  "Wrote favicon.svg, favicon.ico, apple-touch-icon.png and og-image.png to static/."
);
