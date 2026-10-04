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
| `flash-value.svelte` | A value that changes: `<FlashValue value={count.current} />`. Flashes the accent in every place that shows it (color only, no movement). Renders an `<output>`. | Values that change on their own many times a second (it would flash constantly). |
| `state-badge.svelte` | An `AsyncResult`'s state: `<StateBadge result={todo.current} />`. Text is exactly `Initial`, `Success, waiting`, `Failure`, … Plays `success` / `failure` when a run ends. | Sync atoms. |
| `result-chip.svelte` | One result as a colored tile with a caption: `<ResultChip tone="success" busy={r.waiting} label="dieAtom">`. `kind="message"` for a sentence. Keep the example's own `{#if r._tag === …}` and put a chip in each branch. | Lists or long content. |
| `result-history.svelte` | The states an `AsyncResult` has been through, timed: `<ResultHistory result={die.current} />`. No logging code in the example. | Results whose sequence doesn't matter to the section. |
| `event-log.svelte` + `event-log.svelte.ts` | Your own timestamped entries: `const log = new EventLogState(); log.add("saved", { tone: "success" })`, then `<EventLog entries={log.entries} label="Events" />`. | A console for every example. |
| `cause-view.svelte` | A `Cause` taken apart, one row per reason: `<CauseView cause={failure.cause} />`. A typed error (`Fail`), a defect (`Die`, striped) and an interruption (`Interrupt`, dashed) look different; `undefined` says there is no failure. | Showing a failure's message; that's `ResultChip`. |
| `timeline.svelte` | The same entries as dots on a time axis, one row per `lane`: `<Timeline entries={log.entries} lanes={["default", "suspendOnWaiting"]} />`. Pass `now` (ms) to draw a cursor while something is in progress. | Anything where only the order matters (use a log). |
| `run-controls.svelte` | Run, Interrupt and Reset: `<RunControls running={r.waiting} onrun={…} oninterrupt={…} onreset={…} />`. One button turns into Interrupt while running; Reset only with `onreset`. | Effects the reader can't usefully stop; leave `oninterrupt` out. |
| `play-controls.svelte` + `simulation.svelte.ts` | A scripted story with Play / Restart: `new Simulation({ steps: [{ at: 0, run }], reset })`, `<PlayControls playing={sim.playing} onplay={() => sim.play()} onrestart={() => sim.restart()} />`. Call `sim.stop()` on teardown. | Anything the reader drives directly. |
| `part.svelte` | A labeled box in a diagram, with an optional counter that flashes: `<Part label="countAtom" count={readers} countLabel="readers" tone="success">`. `dashed` for absent or released; `code` keeps a label from the code (`countAtom`) in its own case. | Decorating an example that has no parts to tell apart. |
| `arrow.svelte` | A labeled arrow between `Part`s, saying how one depends on the other: `<Arrow label="get" pulse={count.current} />`. `pulse` lights it up when a change travels along it; `both` for read and write; `direction="down"`. | Decoration between things that don't depend on each other. |
| `cue.svelte` | A sound for each change of a value nobody clicked for, such as a stream's items: `<Cue cue="tick" on={clock.current} />`. Silent until the reader has used the example. | Results of a click (`StateBadge` already plays those). |
| `slots.svelte` | A capacity shown directly: `<Slots capacity={3} items={keys} label="entries" />` renders "2 / 3 entries" and dashed empty slots. | Unbounded lists. |
| `origin.svelte` | Where a value was computed, from an atom that records it: `<Origin where={result.value} />` reads "Computed on the server" or "Computed in the browser", with an icon, and flashes when it changes. | Values that don't say where they ran. |
| `server-html.svelte` | What an element had in the page's HTML, fetched again from the server: `<ServerHtml of="width" />` looks up `data-testid="width"`. Puts what the server sent beside what the browser shows now. On a prerendered page, that HTML is the build's. | Anything inside a `pending` boundary's content, which the server never renders (look up an element around the boundary instead). |
| `server-row.svelte` | A row of a comparison: `<ServerRow id="waits-script" read="await useAtomResult">…</ServerRow>` shows the label, `ServerHtml` for that place, and the live content. | A single value; use `ServerHtml` beside it. |

`tone.ts` has the shared `Tone` (`idle`, `running`, `success`, `failure`, `interrupted`) and `toneOf(result)`. The colors are the `--tone-*` variables at the end of `src/app.css`: running is the brand accent, the rest are green, red and gray, each with a text color that keeps AA contrast on its tint in light and dark mode. Interrupted is told apart from idle by a dashed border.

Plain buttons, inputs and `<output>` inside an example are already styled by `.demo` in `app.css`; use them as they are.

## Motion

The kit animates with [Motion](https://motion.dev/) (`animate`, springs, `stagger` from `"motion"`), as Visual Effect does, using its framework-agnostic API driven from Svelte attachments (`{@attach}`). `motion.ts` holds the shared pieces:

- `springs`: Visual Effect's presets (`bouncy` for a result arriving, `contentScale` for a tile's content, `default`, `snappy` for small things).
- `onChange(read, react)`: an attachment that calls `react(element, now, before)` whenever `read()` changes, but not on first render, so a page's own load stays still.
- `enter(keyframes)`: an attachment that animates an element in when it mounts, staggered with others mounting in the same frame (log entries, timeline dots).
- `shake(element)` and `jitter(element)`: Visual Effect's failure shake and its running jitter (the latter returns a stop function to use as an attachment's cleanup).
- `reducedMotion()`: check it before moving, scaling or rotating anything. Under `prefers-reduced-motion` nothing moves; color changes (flashes, tints) stay.

What moves: `FlashValue` only flashes its color; `ResultChip` jitters while busy, then flashes and pops when a result arrives, and shakes on failure; `StateBadge` bounces and pops its icon on a change of state; `EventLog` entries slide in and `Timeline` dots drop in, staggered; `Part` counters flash, a running part's ring breathes and a part bounces when it settles; `Slots` pop when filled and flash when emptied; `PlayControls` beats its Play icon while playing and spins Restart; `RunControls` pops as Run turns into Interrupt and spins Reset. Spinners and the busy shine stay CSS.

To animate a new component:

1. Import `animate` from `"motion"` and what you need from `./motion.ts`.
2. For a change of a prop, make an attachment with `onChange(() => prop, (element, now, before) => …)` and put `{@attach it}` on the element. For a mount, use `{@attach enter({ … })}`. For something that lasts while a condition holds (a pulse while running), write an attachment that reads the condition, starts the animation and returns a cleanup that stops it; Svelte reruns it when the condition changes.
3. Animate colors through a CSS variable rather than a color value (`animate(el, { "--flash": [1, 0] })` with `color-mix(… calc(var(--flash) * 70%) …)` in the style), so the colors follow the theme.
4. Return early when `reducedMotion()` before any movement.
5. Keep `data-testid`s, roles and text where tests read them: animate an element, don't replace it.

Motion is about 20 kB gzipped. Only kit components import it, and only pages with examples import kit components, so it is never in the layout chunk; keep it that way (the header and layout must not import `motion.ts` or anything that does).

## Sound

`sound.ts` plays short cues made with [Tone.js](https://tonejs.github.io/), on Visual Effect's synths (`sound-engine.ts` copies its `TaskSounds` oscillators, envelopes, notes, reverb and volume): `tap` (its configuration chime, walking the pentatonic scale), `start` (its running blip), `success` (its triad chord), `failure` (its bass), `interrupt` (its two-beep alert), `reset` (its G to C), `tick` (its ref-update blip). You rarely call it:

- `Example` plays `tap` for every button, checkbox and radio inside the result. Set `data-cue="start"` (or any cue) on a control to play another, or `data-cue="none"` for silence. `RunControls` and `PlayControls` set theirs.
- Counters use `data-cue="up"` and `"down"`. A control whose press can't do anything right now takes `data-cue="blocked"` (computed, such as `data-cue={fits(n) ? "up" : "blocked"}`): Example then plays a buzz and `refuse()` (`motion.ts`) flashes the control red and shakes it.
- `StateBadge` plays `success` or `failure` when a run ends, but only after the reader has touched that example, so a page's own first load is silent. Pass `sound={false}` if something else in the example plays the outcome.
- Call `play("tick")` yourself only for steps that matter, and never on a timer that runs without the reader.

Nothing plays while the header's sound switch is off (`sound-preference.ts`, localStorage key `sound`, on by default), nor before the reader has interacted with the page.

Tone.js is about 60 kB gzipped, so it loads lazily. The rules:

- `sound.ts` is tiny and may be imported anywhere (the header's toggle does). It must never import `tone` or `sound-engine.ts` statically; only its `import("./sound-engine.ts")` loads them.
- That import happens on the first gesture that would play a cue (a press on an example's control starts it on `pointerdown` through `warm()`, so the click's own cue isn't late), and only while sound is on. With sound off, Tone.js never loads and nothing plays. A cue that waited more than 400 ms for the download is dropped.
- Audio must start inside the gesture. Before Tone.js has loaded, `sound.ts` creates and resumes a plain `AudioContext` in the gesture and Tone.js adopts it (`Tone.setContext`); afterwards every cue calls `Tone.start()` synchronously before playing.
- Firefox's Tone.js refuses a context it didn't make ("param must be an AudioParam" while building the synths), and the error is swallowed, so Firefox was silent. `sound.ts` catches that and builds the engine on a context Tone.js makes itself, started with `Tone.start()`; the click that loaded it gave the page the activation that allows it. Test sound in Firefox as well as Chromium.
- `app.html` has an inline script that marks `<html data-sound="off">` before first paint, so the header shows the right icon before hydration. It reads the same key as `sound-preference.ts`; change both together.

## Tests

Most kit components pass extra attributes on (each file's header says to which element; the controls and `Hint` take none), so give the element a test reads a `data-testid` named after the example and the thing (`die`, `die-state`, `todo-history`). `StateBadge` text is exact (`toHaveText("Success, waiting")`). Read a log's entries with `getByRole("list", { name: "<label>" }).getByRole("listitem")`; each entry's text is `<n> ms <label>`. Name buttons as the reader sees them, and keep `aria-label`s unique on the page: e2e tests find buttons by name.
