---
name: explainer-diagram
description: Build an interactive, step-through HTML diagram that explains a sequence (a timeline across server and browser, a lifecycle, a data flow, a bug and its fix) in the docs site's visual style. Use when Jarred asks for a diagram or visual explanation, says they still can't follow a sequence, or when a PR description needs one.
---

# Explainer diagrams

An explainer is one self-contained HTML page. It walks the reader through a sequence one step at a time: lanes for *where* things happen, boxes whose values change, the code running at each step, and a sentence of takeaway. A fix gets a **Before / After** toggle over the same steps.

You write a **spec**: a primer, lanes, boxes, code snippets and steps, as plain data. The shared engine (`engine/`) draws everything else: the step rail, Back/Next and arrow keys, the toggle, the code panel, the "what the user sees" strip, a link per step (`#before-10`), and light/dark. `scripts/build.mjs` inlines the engine into the page, so a page works anywhere and stays frozen once published. The primer's definitions come from one shared glossary, `glossary.mjs`, so a term reads the same in every diagram.

[examples/bug-2.spec.mjs](examples/bug-2.spec.mjs) is the bug 2 timeline from [#38](https://github.com/jarrednorrisdev/effect-atom-svelte/pull/38), Jarred's reference for "this is what good looks like". Its comments explain each part of the spec, but it predates the primer and the `graph` kind: [examples/scope-cache.spec.mjs](examples/scope-cache.spec.mjs) (bug 1 of [#41](https://github.com/jarrednorrisdev/effect-atom-svelte/pull/41)) shows both. Start from whichever is closer, then reshape it.

The reader is the owner deciding whether to merge, not the code's author. They know Svelte and Effect in general, not this library's internals or Effect's (what a registry node is, what `get.mount` does). A diagram that skips a fundamental loses them at that step.

## 0. First: does the spec format fit this issue?

Before anything else, every time this skill runs, ask: **does the spec format (or the engine behind it) need to change to make the best diagram for this issue?** The engine is a starting point, not a template, and what it can draw today was shaped by earlier diagrams, not by this one.

Read enough of the issue to know its shape, then picture the diagram that would make it obvious to someone who has never seen the code, before looking at the box kinds. Then compare:

- **The picture.** Is the bug about what depends on what (a graph), the order of events (a timeline), a component tree, two copies of the same state drifting apart, a value moving between places? Can the existing kinds show that shape, or would they only describe it in words?
- **The layout.** Do lanes side by side fit, or does it need rows, nesting, a third column, a panel that spans both lanes?
- **The text.** Does the step panel have room for what needs explaining? Does the primer cover the background, or does the reader need something else (a comparison table, an inline mini-diagram, a link per term to the source)?
- **The controls.** Is one Before / After toggle enough, or does it need three variants, a branch, a slider over time?

If any answer is "not well", change the spec format first: add a box kind or a spec field, change the engine's layout, text panel, strip or controls. Try it in the spec module (`kinds` and `css`, section 3), and move it into `engine/` once it's general, documenting it in section 3. Rebuild both examples afterwards and check they still look right. Say what you changed, and why, when you deliver.

Only then go on to section 1. A diagram squeezed into stores and chips because they were there is the failure to avoid. Jarred has said so (2026-10-10).

## 1. Ground truth

Trace the real sequence in the code and tests before drawing anything. For each step, know what proves it: a test, a fixture, a line of source. Code shown as pseudocode gets "simplified" in its file label.

**User code is idiomatic.** Every snippet of app code (a component, an atoms file, a click handler) is what a real user of the library would write, in the style its docs teach: the JSDoc `**Example**` blocks in `packages/effect-atom-svelte/src` and the examples under `apps/demo/src/routes`. A component writes an atom with the setter from `useAtomSet`, reads one with `useAtomValue`, and gets every name it uses from its own snippet, another file shown, or the primer. Where the steps need the machinery underneath (the registry, a hook's internals), show that as its own file, labelled "simplified", so the reader can tell the app's code from the library's. A snippet that cuts a corner to save a line looks like part of the bug, and the reader stops to wonder why. Jarred caught one (`registry.set` in a click handler, 2026-10-10).

**The scenario has a source too.** Where it comes from (a docs page and its file, a docs pattern, a test) goes in the spec's header comment, and every detail the steps claim about it is checked in that code: which atoms exist, in what order, what the user clicks, what the screen shows afterwards (an empty list is not "that atom's rows").

Done when every step has a source, the scenario does too, and every user snippet matches how the docs would write it. A step you can't verify is cut, or labelled as an assumption in its text.

## 2. Storyboard

Start with the **primer** (`primer` in the spec), drawn above the steps:

- **The scenario, in full sentences.** What the app is, what the user does, why each piece exists, and what goes wrong, as a reader would want it told: "Picture a document editor. The page shows… ", not "An editor page. `doc` is the text." If it reads like a code comment, rewrite it.
- **Every term the steps rely on**, each with a plain definition and where it comes from (Effect, Svelte, this library, JavaScript): the registry and its nodes, each API the code panel shows (`get`, `get.mount`, `keepAlive`), the library's own concepts, and the event names. They come from the shared glossary: see [The primer's terms](#the-primers-terms). Steps then link a term as `{{id}}` or `{{id|shown text}}`: underlined, with its definition on hover.

Test it: someone who has never opened this repo reads the primer and step 1, and can picture the app and say what every name on screen is. Step 1 doesn't define things; it uses the primer's terms.

Then write the steps as a plain list:

- **Fundamentals first.** Each term (registry, hydration, a library component) is defined at or before the first step that uses it, with where it comes from: Svelte, SvelteKit, Effect, or this library.
- **A real use case, not an invented one.** The scenario is a place the bug really happens, found before writing a word of the primer. Look, in this order:
  1. **This repo's own code:** the docs site's pages and examples (`apps/demo/src/routes`), its layout, the devtools on the docs site. A bug the docs site itself hits is the strongest case: name the page and file, and the reader can go and see it.
  2. **What the docs tell users to do:** a pattern a docs page or JSDoc `**Example**` teaches (a nested `RegistryProvider` with `initialValues`, a family keyed by id). Cite the page.
  3. **The PR's test**, when its setup is one a user writes as-is.

  Only when none of these reaches the bug, describe the kind of app that would, say plainly in the primer that it's an example, and give the reason a real app is built that way, with the docs page that recommends it. Never pick a scenario because it's easy to draw ("a shop with a chat widget that has its own registry"). Jarred asks "why would anyone do that?" (2026-10-10), and the primer has to answer before they do. The names on screen are the real ones from that code (`cartAtom` from `request.svelte`), not stand-ins.

- **One change per step.** A step that changes two boxes splits in two.
- **Full sentences, and enough of them.** A step's `body` can be a list of paragraphs: use two or three where needed. Say what happens, why, and what it means for the bug. Terse fragments ("`draft` already has a node") make the reader guess; say why it matters ("so the registry creates none, and the inspector reports nothing").
- **Explain the code shown.** Any API a highlighted line uses is in the primer, or explained in that step.
- **Provenance.** When a value appears, its step says where it came from ("this is where the 1 comes from"). The italic `note` carries that takeaway.
- **Lanes** are places: server and browser, parent and child, before and after an `await`.
- **A fix** shares its common steps (`steps.shared`) and diverges into `before` and `after` of equal length, so `#before-10` compares with `#after-10`.

Done when every value on screen at every step is explained by that step or an earlier one.

## 3. Write the spec

Save it as `~/Documents/repos/jnd/scratchpad/effect-atom-svelte/diagrams/<slug>.spec.mjs`, copied from the example. It has these parts:

- **`primer`:** `title`, `intro` (a list of HTML paragraphs: the scenario) and `terms`, picked from the glossary with `terms(...)` (see [The primer's terms](#the-primers-terms)). Shown above the steps, collapsible, and hidden in `?capture` shots.
- **`meta`:** title, subtitle (HTML), kicker, strip label, the end-of-run `verdict` per mode, and optional `beforeLabel`/`afterLabel` for the toggle ("Old advice" / "New advice" when it isn't a bug fix).
- **`lanes`:** each lane's `id`, `label`, and `phase` (the name above the rail).
- **`wire`:** optional. It draws a network line with a `packet` between exactly two lanes.
- **`boxes`:** stacked in their lane in order. Each box has a kind:
  - `store`: a named value (`row`). State is a value, or `{ v, gone: true }`, which greys the box out with its `goneLabel`.

  Any box's object state can add `tone: "bad"` or `"ok"`, which turns it red or green. Use it where things go wrong or right.
  - `text`: a `text` with `{v}` in it.
  - `data`: plain data. State `true` shows its `text`; a string, or `{ text, tone }`, replaces it.
  - `queue`: something waiting. State is `"on"` or `"applied"`.
  - `screen`: what the user sees. State is `{ v, badge, tone: "bad" | "ok", live }`.
  - `graph`: atoms (or anything) and the edges between them. The box places its `nodes` (`{ id, label, x, y }`, with x and y from 0 to 1); a step's state is `{ edges: [[from, to, kind]], show, mark, values }`. Edge kinds: `read` (solid), `mount` (dashed), `new` (amber, draws itself in), `gone` (red, dotted), `bad`, `ok`. `mark` maps a node to `hl`, `bad`, `ok` or `dim`; `values` shows a value under a node's name. `chrome: true` draws it as a window, for what a user sees. Use it whenever the bug is about what depends on what.
- **`files`:** code snippets as plain lines of user code, at most about 55 characters each: the code panel is half the page wide, and longer lines are cut off in screenshots. The build escapes `</script>`.
- **`steps`:** each step has:
  - `side` (a lane id);
  - `file` and `hl` (zero-based lines to highlight);
  - `title`, `body` (HTML, or a list of HTML paragraphs) and `note` (HTML), all of which can link primer terms with `{{id}}`;
  - `active` (the box ids that get the amber ring);
  - `set` (the box states that change; the rest carry over, and `null` hides a box). A hidden box keeps its place until it appears, except on phones; one that a mode never shows takes no room in that mode;
  - `packet` (`true` to send the packet across the wire);
  - `frame` (the value the user sees, for the strip) and `bad`. Frame the steps where that value could change, not every step: ten identical frames are noise.

**A picture the engine can't draw** gets a box kind of its own. To try one out, export it from the spec module:

```js
export const kinds = { timeline: { make(b) { /* returns an element */ }, paint(e, s, b, animate) { /* shows state s */ } } };
export const css = `.timeline { … }`;
```

The build copies their source into the page, so they can't use anything else from the module. Once a kind proves useful beyond one diagram, move it into `engine/stepper.js` (`KINDS`), with its styles in `stepper.css`, and document it above. Changing the engine itself (layout, the text panel, the strip) is fine too: rebuild the example afterwards to check it still looks right.

Build it:

```sh
node ~/Documents/repos/jnd/effect-atom-svelte/.claude/skills/explainer-diagram/scripts/build.mjs <slug>.spec.mjs <slug>.html
```

### The primer's terms

Definitions live in one place, [glossary.mjs](glossary.mjs), so a term such as "Registry and node" reads the same in every diagram. A spec imports `terms` from it (by a relative path: `../../../effect-atom-svelte/.claude/skills/explainer-diagram/glossary.mjs` from the scratchpad's `diagrams/`) and picks what its primer needs, in the order the reader should meet them:

```js
import { terms } from "../../../effect-atom-svelte/.claude/skills/explainer-diagram/glossary.mjs";

primer: {
  terms: terms(
    "provider",
    ["node", "Here, what matters is the node's listeners."],
    "abortSignal",
  ),
},
```

- **An id** gives the glossary's definition as it is.
- **`[id, extra]`** adds one or two sentences after it, saying why the term matters in this diagram ("Here it keeps the draft's text."). This is where anything about the scenario goes. An extra may link other terms with `{{id}}`.
- **`{ id, term, from, html }`**, written out, is only for a name that exists in this one scenario, such as a variable in its code (`reading`, `mounted`). Anything a second diagram could use goes in the glossary.

**A term the glossary doesn't have: add it to the glossary** before using it. Don't write it inline instead. Edit `.claude/skills/explainer-diagram/glossary.mjs` in the checkout you're working in, and commit it with the diagram's PR (or a PR of its own), as it's tracked. Put it under the heading for where the term comes from (Effect, Svelte, JavaScript, this library, its devtools):
- the definition says what the thing is in general, in plain words, with nothing about this diagram's scenario, which goes in the extra;
- check it against the source (Effect's at `~/Documents/repos/reference/effect`, Svelte's in `node_modules/svelte`, this library's in `packages/`);
- no `{{links}}` in a definition: another spec may not pick the term a link points to;
- `term` is what the primer shows, HTML (`<code>Atom.fn</code>`); `from` is the tag beside it.

`terms(...)` throws for an id the glossary lacks, and `build.mjs` refuses a spec that links `{{id}}` without that term in its primer, so a missing term stops the build rather than showing as plain text.

**Improving an existing definition** is fine, and better than working around it with an extra: say so when you deliver. It changes every diagram built afterwards. Pages already published keep the wording they were built with, so a page rebuilt later gets the new one; check it still reads right in that diagram.

## 4. Check

Screenshot it from a checkout that has Playwright installed. Everything is shot in dark mode:

```sh
cd ~/Documents/repos/jnd/worktrees/<any>/packages/effect-atom-svelte
node ~/Documents/repos/jnd/effect-atom-svelte/.claude/skills/explainer-diagram/scripts/shoot.mjs <slug>.html /tmp/<slug>-shots [--key before-10,after-10]
```

`--key` adds `key-<mode>-<step>.png`: just the diagram, at 2x, for a PR description.

Look at every shot. Check that:
- each box shows the value its step claims;
- each key shot shows what goes wrong or right without reading any text: red or green boxes, not just a changed word;
- a newcomer could follow the primer and step 1 without guessing what any name means;
- the scenario is a real use case, with its source in the spec's header, or is labelled as an example with the reason a real app does it (see [Storyboard](#2-storyboard));
- each graph's edges don't overlap or cross nodes, and are told apart without the legend;
- the phase labels under the rail line up with the rail and stay within its width;
- no code line is cut off at the panel's edge;
- every user snippet is idiomatic (see [Ground truth](#1-ground-truth));
- the 390 px phone shot is readable;
- the script reports no console errors.

Done when all of that holds.

## 5. Deliver

- **In chat:** `html_preview`, then `html_render` with the built file's contents. Reply only with what the page doesn't say: what's simplified, and what's next.
- **Always, when the diagram explains a PR** (even one asked for only in chat): publish the built page and link it from that PR's description, as below (no screenshots). Jarred asked for this on 2026-10-10 as standing approval, so don't stop to ask first. A diagram rebuilt later gets republished at the same path, and the link updated if the slug changed. If no PR exists yet, link the diagram when the PR is opened.

### Publishing a PR's diagram

1. A page's path holds the PR number, so open the PR (as a draft) before publishing.
2. Publish the page on the `pr-assets` branch, which shares no history with `main` and is never merged:

   ```sh
   # if missing: git worktree add ~/Documents/repos/jnd/worktrees/esa-pr-assets pr-assets
   cd ~/Documents/repos/jnd/worktrees/esa-pr-assets
   git pull -q
   mkdir -p pr/<number> && cp <slug>.html pr/<number>/<slug>.html
   git add pr/<number> && git commit -m "docs: <slug> diagram for #<number>" && git push
   ```

3. Pages serves it at `https://jarrednorrisdev.github.io/effect-atom-svelte/pr/<number>/<slug>.html` about a minute later. Wait until `curl -sI <url>` says `200` before linking it. A 404 that lasts: check Pages still serves the branch's root (`gh api repos/jarrednorrisdev/effect-atom-svelte/pages -q .source` gives `pr-assets` and `/`; Settings → Pages → "Deploy from a branch" to set it).
4. In the PR body, beside what it explains, link it, deep-linking the step where it goes wrong. Every step has its own hash, `#before-<n>` or `#after-<n>`:

   ```md
   **[Step through the whole page load](…/pr/38/bug-2.html#before-1)**: [step 10](…#before-10) is where it goes wrong, and [the same step with the fix](…#after-10).
   ```

A diagram that explains a lasting concept, rather than one PR, belongs in the docs site (`apps/demo`) as a deliberate docs change.

## Style

The engine carries the docs site's tokens (`apps/demo/src/app.css`). In T3 they follow the host theme; on their own they follow the reader's light or dark setting. Keep to that look in new box kinds:
- flat 1 px borders, with no shadows except the amber ring on active boxes;
- labels in mono uppercase at 0.7 rem, letter-spacing 0.08 em;
- Geist for prose, JetBrains Mono for code and values (with ligatures off, so `=>` stays as typed), and Libron italic for the takeaway note;
- amber (`--brand`) for marks, with amber text via `--brand-ink`;
- `--bad` red and `--ok` green only for outcomes that are wrong or right.
