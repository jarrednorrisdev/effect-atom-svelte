# Pitfalls hit while improving pages

## Svelte async

- **Writing `$state` synchronously during an atom load or a render throws.** The errors are `invariant_violation: Batch has scheduled effects` and `state_unsafe_mutation`.
  - Defer log writes with `setTimeout`.
  - Or derive status from a log, rather than writing state inside an atom's computation.
- **Effects are held back while an awaited list in the markup loads.** Anything that counts or logs through `$effect` misses events in that window.
  - Subscribe through the registry instead (`getRegistry().subscribe`). See `kit/requests.svelte.ts`.

## Dev server

- **Rebuilding `packages/effect-atom-svelte` while dev runs leaves several copies of `RegistryContext.js`.** Hooks then fall back to the shared browser registry, so examples that should be isolated move together (e.g. carts shared between server requests). Restart dev after every library build.
- **The demo API doesn't watch `packages/demo-domain`.** Restart it after changing the domain.
- **Deleting files can leave the SSR graph returning 500.** Restart dev.
- **Saving a `+page.md` can briefly 500 with `state_read_outside_render`.** Reload.
- **Dev sometimes serves a stale stylesheet.** Touch the CSS file.
- **`bun run check` restores the library's build from turbo's cache.** That counts as a rebuild: restart dev afterwards.
- **A dev server started as a background task stops at the task's time limit.** Start it with the longest timeout allowed, and start it again when pages stop loading.

## Routes

- **SvelteKit treats `server.ts` and `*.server.ts` in `src/routes` as server-only,** and refuses to import them into a page. Name an example's pretend backend `api.ts`.
- **Pages that call the demo API (`#lib/clients.ts`) are prerendered only when the build runs the API.** Their `+page.ts` exports `inTabApi as prerender`, and the header shows a demo API reset button for the paths in `demoApiPages` (`lib/docs/site-header.svelte`). When a page starts or stops calling the demo API, change both. Every other page exports `prerender = true`.
- **`vite/api-reference.ts` links each export to a guide section,** and the build fails when that section is gone. `scripts/check-links.mjs` checks them.

## Hydration and server output

- **A history component mounts after hydration, so it never sees the server's value.** Use `ServerHtml` or `ServerRow`.
- **`ServerHtml` can't see inside a `pending` boundary's content.** The server never renders it, so look up an element around the boundary instead.
- **Swapping one `{@html}` keeps the server's HTML.** Render every panel and hide the inactive ones.

## CSS

- **`.demo` button and input margins are unlayered, so they beat Tailwind.** Use `mr-0!` or a wrapper element.
- **`.demo label` and `.demo section` styles leak into wrappers.** Use `<div role="group">` instead.
- **Styles in `example.svelte` `:global` don't load on pages with no `<Example>`.**
- **Svelte trims `&#32;` at element edges.** Use `&nbsp;`.

## Controls and sound

- **A `disabled` button fires no click, so it can't play `blocked`.** Use `aria-disabled` and a guard in the handler.
- **Test sound in Firefox as well as Chromium.** Tone.js behaves differently there.

## Tests

- **A new header or page-wide button can collide with an e2e lookup.** Tests use names like `getByRole("button", { name: /Remove|Reset/ })`. Keep `aria-label`s unique on the page.
- **Converted toggles need the `setPressed(button, on)` helper in e2e tests** (`apps/demo/e2e/toggle.ts`), not `.check()`.
- **There are two e2e folders:** `apps/demo/e2e/` and `apps/demo/e2e-hosted/`, run with `playwright.hosted.config.ts`. Grep both.
- **`page.route` can only hold a request that goes over the network.** To hold an in-memory effect, such as a pretend API's `Effect.sleep`, call `page.clock.install()` before `goto`, then `page.clock.pauseAt(Date.now() + 1000)` before the click, and `page.clock.resume()` to let it finish.
- **`bun run --cwd apps/demo test` stops at the first stage that fails** (vitest, then e2e, then the hosted config). Run the stages after it yourself.
- **Some e2e tests fail now and then under full parallel load,** in one engine only. Rerun a failure with `--repeat-each 3` before treating it as yours, and name it when you report.
- **New icon imports (`@lucide/svelte/icons/*`) used in Testing-page examples must be added to `optimizeDeps.include`** in `apps/demo/vitest.config.ts`. Otherwise Vite re-bundles mid-run and two Svelte copies load.

## Upstream behavior

- **Document upstream Effect Atom behavior; don't paper over it.**
  - `AtomRpc`/`AtomHttpApi` `mutation` is a non-concurrent `Atom.fn`, so a second call interrupts the first.
  - `Atom.pull` with `disableAccumulation` ends the stream with `NoSuchElementError`.
