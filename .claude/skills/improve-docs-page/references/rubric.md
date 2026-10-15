# Rubric

Work through these in order. Each item includes a real case from Jarred's first review (`human-review-1`, Oct 2026) showing what was wrong and what it became.

## 1. Ordering

- **Purpose first.** Open each section with one sentence saying what the thing is for. Then give a short snippet, then the fine print, then the live example.
  - Case: the reader had to dig to find what `useAtomMount` was for. The section now opens with its purpose.
- **Prose snippet before the live example.** The example confirms what the snippet just showed.
- **General statements belong in the section intro, not in a hint.** A hint is only "what to click, what to watch".
- **Order sections by what the reader needs first.**
  - The simple, common case comes before options and edge cases.
  - Each section should only depend on sections above it, or on earlier pages in `nav.ts`.
- **Put important notices at the top of the intro** as `<Aside type="caution|note" title="…">`.
- **Use a numbered step list** for flows that cross the server and the browser.
- **Write headings that say what the section contains,** e.g. "Which atoms to serialize" or "Holding an atom from a component". If you rename one, update the links that point at its anchor (grep for `#old-anchor`).

## 2. Concept

- **Explain the cause, not just the effect.** For example: "ticksAtom depends on tickIntervalAtom, so it computes again, and its finalizer clears the old interval first."
- **Say exactly what the reader will see:** "takes two seconds", "the log shows the stream stopped".
- **Be honest and exact about alternatives and credit.**
  - Case: why-atoms credits `createContext` and remote `query`, and has a "When you don't need atoms" list.
  - Case: "inspired by" Visual Effect, not "largely follows".
- **State surprising behavior plainly rather than hiding it.**
  - `Atom.fn` with `concurrent: true` settles with the oldest call's result.
  - `disableAccumulation` ends with a `NoSuchElementError` failure instead of `done`.
- **Watch for phrasing that implies the wrong scope.**
  - Case: "That leaves state…" read as "atoms are only for this".
- **Use concrete nouns** (a filter, a draft, a selected todo) rather than abstract ones (a value, some data).

## 3. Example fit

- **The example must prove the point the prose makes.** If the prose contrasts two things, the example needs both.
  - Case: the awaits example gained an `Effect.all` side, then a "Todos fails" toggle to show its real benefit, which is that it interrupts the other load.
  - Case: scoped atoms got a "Scoped atom | Module atom" switch.
- **Make the mechanism visible, not just usable.**
  - Case: a finalizer that cleared an invisible interval. It became a timers panel where each timer has a status: running, "stopped by the finalizer", or "leaked: still ticking".
  - Case: one stream reader. It became Readers A and B with "Read clockAtom" toggles and an EventLog of the stream starting and stopping.
- **Show the history when the history is the point.**
  - Stream pulls are grouped by pull with `Chunks`.
  - The countdown shows an emitted strip, `3 → 2 → 1 → ✓ ended`.
  - Lazy promise vs effect lists every result.
- **Show network effects.** Query parts get `RequestCount`. Timing claims get a `Timeline` with one lane per load.
- **For server-rendered values, show what the server sent with `ServerHtml`.** A `ResultHistory` mounts after hydration and never sees the server's value.
- **Every failure path the prose mentions needs a button that triggers it,** such as "Paste a long title", "Todo 99", or "MD5 (not in Web Crypto)".
- **Prefer a realistic mini-app to abstract counters.**
  - Lifetimes became a `BrowserFrame` with Inbox and Chat pages.
  - Scoped atoms became note editors.
  - A preview must differ from its input, or it adds nothing.
- **Don't duplicate another page's example.** Link to it instead (e.g. auth headers live in `/cookbook#auth-headers`).
- **Every control should do something meaningful.** If a button's purpose reads wrong, rename it or redesign it.
  - Case: "End request" read as a reset. It became "Send another request", which retires the oldest request after 1 s and shows it dashed, with "Ended: its registry is disposed".

## 4. Example polish

- **Make timing perceptible.** A load the reader should notice takes about 1.5–2 s and gets a "Load again" button. Stream ticks are 500 ms apart, not 200.
- **Respond immediately.** Within a frame of the click:
  - mark the row `aria-busy`;
  - disable buttons while a non-concurrent mutation waits;
  - show "Loading…" on a pull button;
  - use `ResultChip duration` for an in-flight bar.
- **Show lifecycle visibly.** Use a dashed `Part` when an atom is not in the registry, and show holder or reader counts.
- **Label every result.** Use one row per atom name, with a `StateBadge`. Don't list bare results like "(Failure, Success)".
- **Keep layout stable.**
  - Lay out a row of Parts with the kit's `Parts`: equal widths and heights, contents and `actions` lined up, and a dashed rule between parts with no arrow between them (independent). Chains of three stack on a phone; add `stack` when a shorter chain's contents need the width. Don't use it for fan-outs (one part feeding two) or grids of hooks on the same atom.
  - Diagrams fit one row on desktop and stack on a phone.
  - Line up edges, e.g. Clear at the flex end, and buttons level with the input's right edge.
- **No jitter.** Ticking numbers use `tabular-nums`. Progress is one CSS animation, not a bar stepped in JS. Changed values flash color only.
- **Use color sparingly, and only with meaning.**
  - Case: colored providers were "too much". A 4 px left stripe plus a colored dot was kept.
  - Hot is red, cold is sky blue, mild is amber.
- **Show empty states.** An empty `<output>` shows a muted "empty", and `ServerHtml` shows "(empty)".
- **Use sound cues through `data-cue`.**
  - `up`/`down` on counters.
  - `reset` for dispose and delete.
  - `blocked`, plus a shake via `refuse()`, for an action that can't happen now. Use `aria-disabled` with a guard, because a `disabled` button fires no click.
- **Make limits explicit,** e.g. guard against unsafe-integer overflow with `blocked`.

## 5. Shown code

- **No presentation noise in shown files.** Remove `<style>` blocks and use Tailwind classes. Move diagrams and inspectors into separate, unshown components beside the example.
- **Atom names say what they hold.** `everyAtom` became `tickIntervalAtom`, and `sharedDraftAtom` became `moduleDraftAtom`. Shorten long expressions into named refs when a label overflows on phones (`nameRef`).
- **Layers are standalone `XLayer` consts** (`TodosLayer`, `FairDiceLayer`): no `Live` suffix and no `static layer`.
- **Order file tabs from the core module outward:** the `.ts` with atoms first, then the outer component, then the components inside it.
- **Comment only the confusing bit,** e.g. "Created once, when this module first loads" versus "once per editor".
- **Keep lines under about 75 characters.** Past that, the code frame scrolls sideways at 1280 px.
- **Show failures as Effect sees them.**
  - Failures go in `CauseView`, which renders "TodoNotFound { id: 99 }" or "SchemaError: Expected an integer at [\"id\"]".
  - Types go in `EffectType`, e.g. `digest(…): Effect<string, UnsupportedAlgorithm>`, where the failing union member lights up and the type narrows when catchTag is on.
  - Delete hand-written `describe`/`errorTag`/Match-to-string helpers.
  - `CauseView` shows a tagged error's `message` when it has one, and its fields when it has none. Leave `message` out of an example's error class when the fields are what the reader should see.
- **Put what the page teaches in the first 14 lines.** `Example` shows a long source's first 14 lines and hides the rest behind "Show all N lines", so the atoms belong at the top of the `<script module>`. Leave out code the page doesn't teach, such as a remove button on a page about queries: the header's demo API reset covers cleanup.
- **A prose snippet shows one idea, not the example again.** If the example just below already shows the code, cut the snippet to the line that matters, or link to the example. Don't repeat a snippet another page already has: name it and link there.
- **Imports in snippets:** the first snippet on a page that introduces an API keeps its imports and `<script>` wrapper, so it can be copied as it is. Later snippets that illustrate one expression leave them out.

## 6. Controls and feedback

- **Toggles are `<button aria-pressed>`.** Their `::before` dot is hollow when off and filled when on, so they don't look like action buttons.
- **Choices are a `role="group"` with an `aria-label`,** containing aria-pressed buttons, e.g. Algorithm, Filter (All/Open/Done), Todo (1/2/99), Theme.
- **Page switches use `BrowserFrame` nav with `aria-current="page"`.**
- **Numbers use `Stepper`.** A count that only goes up is a button plus a `FlashValue` in a `.button-group`.
- **Icon-only buttons need an `aria-label`.** For example, a trash icon (`Trash2Icon`) with `data-cue="reset"` and the name "Remove <title>".
- **Keep labels short.** Put the detail in `aria-label` ("×10" with the label "Multiply by 10").
- **Hint verbs match the controls.** Use "Click" or "Turn on", not "Pick", "Tick" or "Select".

## 7. Prose

- **Use plain, concrete sentences.** No marketing, and no `*emphasis*` in hints (oxfmt rewrites it).
- **A hint is an imperative recipe of one to three steps,** e.g. "Turn on Reader B: it shows the same count. Turn off A…".
- **Show names from code as code:** `loadedAtom`, `<Feed>`, `query("getTodo", { id })`. That applies to Part labels too (use the `code` prop), not uppercase captions.
- **Make the result and the prose use the same words** for states: `Success, waiting`, `Failure, interrupted`.

## 8. Links

- **Cross-link with section anchors:** `/effect-basics#exit-and-cause`, `/suspense#when-it-fails`.
- **Link out to Effect's docs** for core Effect concepts (Exit, Cause, Stream) rather than re-explaining them.
- **Link concepts the reader may have skipped** back to the earlier page that introduces them.
