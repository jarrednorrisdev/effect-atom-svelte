# Example kit

Small components that make the live examples clear and fun to use, after [effect.kitlangton.com](https://effect.kitlangton.com/) (tiles that show idle, running, succeeded and failed; visible timing; short sounds) and Effect's Module of the Week posts (Play / Restart simulations, labeled parts, counters shown directly). Each file starts with a comment showing its props and an example.

## The rule: fit the example, don't shoehorn

Take the quality, not a checklist. Add a piece only when it helps the reader see what the section teaches, and leave out any control that would do nothing meaningful.

- A counter needs clear feedback (`FlashValue`), not Run, Interrupt or a timeline.
- A form needs good pending and error states (`StateBadge`, `ResultChip`), not Play / Restart.
- An async atom's refresh is about `waiting` and order, so a `ResultHistory` earns its place there.
- Interrupt only where stopping is something the reader can see (a slow save they cancel), not on an atom that the registry interrupts by itself.
- A timeline only where timing is the point: a refresh and `waiting`, two boundaries resolving at different times, reactivity keys, streams.

The example's `.svelte` file is shown as its source, so keep its own code readable. Presentation goes in kit components; a kit component takes the example's values (`result={die.current}`) and does the rest. If a visualization needs more than the example's code (a diagram of the registry), make it a separate component beside the example.

The two reference pages are `src/routes/first-atom` (sync: `Part`, `FlashValue`, a hint) and `src/routes/async-atoms` (async: `ResultChip`, `StateBadge`, `ResultHistory`, a hint). Copy their pattern.

## Components

Import each file directly (`#lib/docs/kit/state-badge.svelte`); there is no index, so a page only loads what it uses.

| File | Use it for | Don't use it for |
| --- | --- | --- |
| `hint.svelte` | The "what to try" line. Usually Example's `hint` prop: `<Example hint="Click Refresh, then watch both values." …>`. One or two sentences: what to click, what to watch. | Explaining the concept; that's the page's prose. |
| `flash-value.svelte` | A value that changes: `<FlashValue value={count.current} />`. Flashes the accent and ticks up or down, in every place that shows it. Renders an `<output>`. | Values that change on their own many times a second (it would flash constantly). |
| `state-badge.svelte` | An `AsyncResult`'s state: `<StateBadge result={todo.current} />`. Text is exactly `Initial`, `Success, waiting`, `Failure`, … Plays `success` / `failure` when a run ends. | Sync atoms. |
| `result-chip.svelte` | One result as a colored tile with a caption: `<ResultChip tone="success" busy={r.waiting} label="dieAtom">`. `kind="message"` for a sentence. Keep the example's own `{#if r._tag === …}` and put a chip in each branch. | Lists or long content. |
| `result-history.svelte` | The states an `AsyncResult` has been through, timed: `<ResultHistory result={die.current} />`. No logging code in the example. | Results whose sequence doesn't matter to the section. |
| `event-log.svelte` + `event-log.svelte.ts` | Your own timestamped entries: `const log = new EventLogState(); log.add("saved", { tone: "success" })`, then `<EventLog entries={log.entries} label="Events" />`. | A console for every example. |
| `timeline.svelte` | The same entries as dots on a time axis, one row per `lane`: `<Timeline entries={log.entries} lanes={["default", "suspendOnWaiting"]} />`. | Anything where only the order matters (use a log). |
| `run-controls.svelte` | Run, Interrupt and Reset: `<RunControls running={r.waiting} onrun={…} oninterrupt={…} onreset={…} />`. One button turns into Interrupt while running; Reset only with `onreset`. | Effects the reader can't usefully stop; leave `oninterrupt` out. |
| `play-controls.svelte` + `simulation.svelte.ts` | A scripted story with Play / Restart: `new Simulation({ steps: [{ at: 0, run }], reset })`, `<PlayControls playing={sim.playing} onplay={() => sim.play()} onrestart={() => sim.restart()} />`. Call `sim.stop()` on teardown. | Anything the reader drives directly. |
| `part.svelte` | A labeled box in a diagram, with an optional counter that flashes: `<Part label="countAtom" count={readers} countLabel="readers" tone="success">`. `dashed` for absent or released. | Decorating an example that has no parts to tell apart. |
| `slots.svelte` | A capacity shown directly: `<Slots capacity={3} items={keys} label="entries" />` renders "2 / 3 entries" and dashed empty slots. | Unbounded lists. |

`tone.ts` has the shared `Tone` (`idle`, `running`, `success`, `failure`, `interrupted`) and `toneOf(result)`. The colors are the `--tone-*` variables at the end of `src/app.css`: running is the brand accent, the rest are green, red and gray, each with a text color that keeps AA contrast on its tint in light and dark mode. Interrupted is told apart from idle by a dashed border.

Plain buttons, inputs and `<output>` inside an example are already styled by `.demo` in `app.css`; use them as they are.

## Motion

Every animation is short and explains a change (a value arriving, a state changing, a run in progress). Each component turns its movement off under `prefers-reduced-motion`; color changes stay.

## Sound

`sound.ts` synthesizes short cues with Web Audio (no files): `tap`, `start`, `success`, `failure`, `interrupt`, `reset`, `tick`. You rarely call it:

- `Example` plays `tap` for every button, checkbox and radio inside the result. Set `data-cue="start"` (or any cue) on a control to play another, or `data-cue="none"` for silence. `RunControls` and `PlayControls` set theirs.
- `StateBadge` plays `success` or `failure` when a run ends, but only after the reader has touched that example, so a page's own first load is silent. Pass `sound={false}` if something else in the example plays the outcome.
- Call `play("tick")` yourself only for steps that matter, and never on a timer that runs without the reader.

Nothing plays while the header's sound switch is off (`sound-preference.ts`, localStorage key `sound`, on by default), nor before the reader has interacted with the page.

## Tests

Most kit components pass extra attributes on (each file's header says to which element; the controls and `Hint` take none), so give the element a test reads a `data-testid` named after the example and the thing (`die`, `die-state`, `todo-history`). `StateBadge` text is exact (`toHaveText("Success, waiting")`). Read a log's entries with `getByRole("list", { name: "<label>" }).getByRole("listitem")`; each entry's text is `<n> ms <label>`. Name buttons as the reader sees them, and keep `aria-label`s unique on the page: e2e tests find buttons by name.
