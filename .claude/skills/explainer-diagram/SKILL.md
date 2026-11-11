---
name: explainer-diagram
description: Build an interactive, step-through HTML diagram that explains a sequence (a timeline across server and browser, a lifecycle, a data flow, a bug and its fix). Use when Jarred asks for a diagram or visual explanation, says he still can't follow a sequence, or when a PR description needs one.
---

# Explainer diagrams

An explainer is one self-contained HTML page. It walks the reader through a sequence one step at a time: lanes for _where_ things happen, boxes whose values change, the code running at each step, and a sentence of takeaway. A fix gets a **Before / After** toggle over the same steps.

You write a **spec**: a primer, lanes, boxes, code snippets and steps, as plain data. The shared engine (`engine/`) draws everything else: the step rail, Back/Next and arrow keys, the toggle, the code panel, the "what the user sees" strip, a link per step (`#before-10`), and light/dark. `scripts/build.mjs` inlines the engine into the page, so a page works anywhere and stays frozen once published.

[examples/scope-cache.spec.mjs](examples/scope-cache.spec.mjs) is Jarred's reference for "this is what good looks like", from effect-atom-svelte. Its comments explain each part of the spec. Start from it, then reshape it.

The repo's `docs/agents/diagrams.md`, when it has one, says where its glossary lives, where its real scenarios come from, where Playwright is installed, and how a PR's diagram is published.

The reader is the owner deciding whether to merge, not the code's author. They know the stack in general, not this repo's internals or its libraries'. A diagram that skips a fundamental loses them at that step.

## 0. First: does the spec format fit this issue?

Every time, ask: **does the spec format (or the engine behind it) need to change to make the best diagram for this issue?** The engine is a starting point, not a template: what it draws today was shaped by earlier diagrams, not by this one.

Picture the diagram that would make the issue obvious to someone who has never seen the code, before looking at the box kinds. Then compare:

- **The picture.** Is it about what depends on what (a graph), the order of events (a timeline), a component tree, two copies of the same state drifting apart, a value moving between places? Can the existing kinds show that shape, or only describe it in words?
- **The layout.** Do lanes side by side fit, or does it need rows, nesting, a third column, a panel that spans both lanes?
- **The text.** Does the step panel have room for what needs explaining? Does the primer cover the background?
- **The controls.** Is one Before / After toggle enough, or does it need three variants, a branch, a slider over time?

If any answer is "not well", change the format first: add a box kind or a spec field, or change the engine's layout, text panel, strip or controls (section 3). Rebuild the example afterwards and check it still looks right. Say what you changed, and why, when you deliver. A diagram squeezed into the kinds that were there is the failure to avoid.

## 1. Ground truth

Trace the real sequence in the code and tests before drawing anything. For each step, know what proves it: a test, a fixture, a line of source. Code shown as pseudocode gets "simplified" in its file label.

**User code is idiomatic.** Every snippet of app code is what a real user of the code would write, in the style the repo's docs and examples teach. Where the steps need the machinery underneath, show that as its own file, labelled "simplified", so the reader can tell the app's code from the library's. A snippet that cuts a corner to save a line looks like part of the bug, and the reader stops to wonder why.

**The scenario has a source too.** Where it comes from (a docs page, an example, a test) goes in the spec's header comment, and every detail the steps claim about it is checked in that code: what exists, in what order, what the user clicks, what the screen shows afterwards.

Done when every step has a source, the scenario does too, and every user snippet matches how the docs would write it. A step you can't verify is cut, or labelled as an assumption in its text.

## 2. Storyboard

Start with the **primer** (`primer` in the spec), drawn above the steps:

- **The scenario, in full sentences.** What the app is, what the user does, why each piece exists, and what goes wrong: "Picture a document editor. The page shows… ", not "An editor page. `doc` is the text." If it reads like a code comment, rewrite it.
- **Every term the steps rely on**, each with a plain definition and where it comes from, picked from the glossary (see [The primer's terms](#the-primers-terms)). Steps then link a term as `{{id}}` or `{{id|shown text}}`: underlined, with its definition on hover.

Test it: someone who has never opened this repo reads the primer and step 1, and can picture the app and say what every name on screen is.

Then write the steps as a plain list:

- **A real use case, not an invented one.** The scenario is a place the issue really happens, found before writing a word of the primer: the repo's own code first, then a pattern its docs teach, then the PR's test when its setup is one a user writes as-is. Only when none of these reaches it, describe the kind of app that would, say plainly in the primer that it's an example, and give the reason a real app is built that way. Jarred asks "why would anyone do that?", and the primer has to answer first. The names on screen are the real ones from that code.
- **Fundamentals first.** Each term is defined at or before the first step that uses it.
- **One change per step.** A step that changes two boxes splits in two.
- **Full sentences, and enough of them.** A step's `body` can be a list of paragraphs: say what happens, why, and what it means for the issue.
- **Explain the code shown.** Any API a highlighted line uses is in the primer, or explained in that step.
- **Provenance.** When a value appears, its step says where it came from. The italic `note` carries that takeaway.
- **Lanes** are places: server and browser, parent and child, before and after an `await`.
- **A fix** shares its common steps (`steps.shared`) and diverges into `before` and `after` of equal length, so `#before-10` compares with `#after-10`.

Done when every value on screen at every step is explained by that step or an earlier one.

## 3. Write the spec

Save it in the scratchpad, `scratchpad/<repo>/diagrams/<slug>.spec.mjs` beside the repo's main checkout (the parent of `git rev-parse --path-format=absolute --git-common-dir`), copied from the example. It has these parts:

- **`primer`:** `title`, `intro` (a list of HTML paragraphs: the scenario) and `terms`, picked from the glossary. Shown above the steps, collapsible, and hidden in `?capture` shots.
- **`meta`:** title, subtitle (HTML), kicker, strip label, the end-of-run `verdict` per mode, and optional `beforeLabel`/`afterLabel` for the toggle ("Old advice" / "New advice" when it isn't a bug fix).
- **`lanes`:** each lane's `id`, `label`, and `phase` (the name above the rail).
- **`wire`:** optional. It draws a network line with a `packet` between exactly two lanes.
- **`boxes`:** stacked in their lane in order. Any box's object state can add `tone: "bad"` or `"ok"`, which turns it red or green: use it where things go wrong or right. Each box has a kind:
  - `store`: a named value (`row`). State is a value, or `{ v, gone: true }`, which greys the box out with its `goneLabel`.
  - `text`: a `text` with `{v}` in it.
  - `data`: plain data. State `true` shows its `text`; a string, or `{ text, tone }`, replaces it.
  - `queue`: something waiting. State is `"on"` or `"applied"`.
  - `screen`: what the user sees. State is `{ v, badge, tone, live }`.
  - `graph`: things and the edges between them. The box places its `nodes` (`{ id, label, x, y }`, with x and y from 0 to 1); a step's state is `{ edges: [[from, to, kind]], show, mark, values }`. Edge kinds: `read` (solid), `mount` (dashed), `new` (amber, draws itself in), `gone` (red, dotted), `bad`, `ok`. `mark` maps a node to `hl`, `bad`, `ok` or `dim`; `values` shows a value under a node's name. `chrome: true` draws it as a window. Use it whenever the issue is about what depends on what.
- **`files`:** code snippets as plain lines of user code, at most about 55 characters each: the code panel is half the page wide, and longer lines are cut off in screenshots.
- **`steps`:** each step has:
  - `side` (a lane id);
  - `file` and `hl` (zero-based lines to highlight);
  - `title`, `body` (HTML, or a list of HTML paragraphs) and `note` (HTML), all of which can link primer terms with `{{id}}`;
  - `active` (the box ids that get the amber ring);
  - `set` (the box states that change; the rest carry over, and `null` hides a box);
  - `packet` (`true` to send the packet across the wire);
  - `frame` (the value the user sees, for the strip) and `bad`. Frame the steps where that value could change, not every step.

**A picture the engine can't draw** gets a box kind of its own. To try one out, export it from the spec module:

```js
export const kinds = { timeline: { make(b) { /* returns an element */ }, paint(e, s, b, animate) { /* shows state s */ } } };
export const css = `.timeline { … }`;
```

The build copies their source into the page, so they can't use anything else from the module. Once a kind proves useful beyond one diagram, move it into `engine/stepper.js` (`KINDS`), with its styles in `stepper.css`, and document it above. A change to `engine/` is a change to this skill: make it in jnd-skills, and `--promote` it from a repo that tweaked it.

Build it:

```sh
node <this skill>/scripts/build.mjs <slug>.spec.mjs <slug>.html --glossary <the repo's glossary>
```

### The primer's terms

Definitions live in one place, the repo's glossary module (`docs/agents/diagrams.md` names it; [examples/glossary.mjs](examples/glossary.mjs) shows the shape), so a term reads the same in every diagram. A primer's `terms` lists picks, in the order the reader should meet them:

- **An id** gives the glossary's definition as it is.
- **`[id, extra]`** adds one or two sentences after it, saying why the term matters in this diagram ("Here it keeps the draft's text."). Anything about the scenario goes here. An extra may link other terms with `{{id}}`.
- **`{ id, term, from, html }`**, written out, is only for a name that exists in this one scenario, such as a variable in its code. Anything a second diagram could use goes in the glossary.

**A term the glossary doesn't have: add it there** first, and commit it with the diagram's PR. A repo with no glossary yet starts one at the path `diagrams.md` names, or `docs/diagrams/glossary.mjs`. Put each term under the heading for where it comes from:

- the definition says what the thing is in general, in plain words, checked against the source, with nothing about this diagram's scenario;
- no `{{links}}` in a definition: another spec may not pick the term a link points to;
- `term` is what the primer shows, HTML (`<code>Atom.fn</code>`); `from` is the tag beside it.

The build stops on a pick the glossary lacks, and on a spec that links `{{id}}` without that term in its primer, so a missing term never shows as plain text. Improving a definition changes every diagram built afterwards; pages already published keep the wording they were built with.

## 4. Check

Screenshot it, in dark mode, from a folder that has Playwright installed (`diagrams.md` names one):

```sh
node <this skill>/scripts/shoot.mjs <slug>.html <shots dir> [--key before-10,after-10]
```

`--key` adds `key-<mode>-<step>.png`: just the diagram, at 2x, for a PR description.

Look at every shot. Check that:

- each box shows the value its step claims;
- each key shot shows what goes wrong or right without reading any text: red or green boxes, not just a changed word;
- a newcomer could follow the primer and step 1 without guessing what any name means;
- the scenario is a real use case with its source in the spec's header, or is labelled as an example with its reason;
- each graph's edges don't overlap or cross nodes, and are told apart without the legend;
- the phase labels under the rail line up with the rail and stay within its width;
- no code line is cut off at the panel's edge;
- every user snippet is idiomatic;
- the 390 px phone shot is readable;
- the script reports no console errors.

Done when all of that holds.

## 5. Deliver

- **In chat:** `html_preview`, then `html_render` with the built file's contents. Reply only with what the page doesn't say: what's simplified, and what's next.
- **When the diagram explains a PR:** publish the built page the way `diagrams.md` says and link it from the PR's description, beside what it explains, deep-linking the step where it goes wrong (`#before-10`, and `#after-10` for the fix). Jarred has given standing approval, so don't stop to ask. A rebuilt diagram is republished at the same path. A repo with nowhere to publish gets the diagram in chat only, and the PR says so.

A diagram that explains a lasting concept, rather than one PR, belongs in the repo's docs as a deliberate docs change.

## Style

The engine carries its own tokens. In T3 they follow the host theme; on their own they follow the reader's light or dark setting. Keep to that look in new box kinds:

- flat 1 px borders, with no shadows except the amber ring on active boxes;
- labels in mono uppercase at 0.7 rem, letter-spacing 0.08 em;
- Geist for prose, JetBrains Mono for code and values (with ligatures off, so `=>` stays as typed);
- amber (`--brand`) for marks, with amber text via `--brand-ink`;
- `--bad` red and `--ok` green only for outcomes that are wrong or right.
