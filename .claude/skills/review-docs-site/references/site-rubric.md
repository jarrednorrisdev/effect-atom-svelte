# Site rubric

Check every page against every item. The cases come from the first site-wide review (Oct 2026, 39 findings).

## 1. Earns its place

- **Each example proves something about this library that its page teaches.** An example that only teaches Effect becomes a snippet with a link to Effect's docs.
  - Case: Effect basics' Schema decode example.
- **A section that only says "see X" is a stub.** Gather a page's stubs into one "Elsewhere in these docs" list at the end, or drop them.
  - Case: Cookbook's "Retry with backoff", "Cancel a mutation in flight", "Keep a value across reloads"; Troubleshooting's "Plain Svelte".

## 2. Repeats

- **Group examples by their demo pattern: the same controls for the same payoff.** Cases from the first review:
  - plain / `keepAlive` / idle TTL side by side: Lifetimes, Families and Async atoms;
  - `catchTag` taking an error out of the type: Effect basics and Errors;
  - "records where it ran, then Compute again": Hydration and SvelteKit;
  - a todo form with "Paste a long title" failing with `TitleTooLong`: six examples;
  - "pick a todo, 99 fails as a typed error": five examples;
  - "add a reader, remove it, the resource is released": seven examples. These stayed, because each shows a different API (finalizer, `acquireRelease`, a layer, a stream, an `AbortSignal`).
- **Keep one canonical example per pattern:** the one on the page whose subject it is, with the best visualization. The others become a sentence and a link. Keep a second only for a payoff of its own. Case: Async atoms' cache example stayed because it counts requests.
- **A snippet another page already has gets named and linked.** Case: the `Todos` service declared on Effect basics and again on Services; the RPC client written out three times.
- **One topic gets one home.** Advice spread over several pages becomes one section, and the others link to it. Case: `initialValues` across six pages became SvelteKit's "Starting atoms from request data".
- **A hub page that restates other pages becomes the canonical one,** and the copies shrink to a line and a link. Case: Errors, against Mutations, Suspense and Effect basics.

## 3. Wrong page

- **A page uses an API taught on a later page.** Rebuild the example on what the reader already knows, or move it. Case: Mutations used the RPC client before the RPC page; it now runs on `Atom.runtime` with an in-memory pretend API.
- **Advanced material sits where beginners read.** Move it to the page where its use case lives. Case: `useAtomInitialValues` on page 5.
- **A page depends on another page for its basics.** Give it its own options table and recipe links. Case: HTTP API sent readers to RPC for its query options.

## 4. Sidebar order

- **Each page depends only on pages before it.** For each page, list the APIs its prose and code use, and where each is taught.
- **Pages that pair sit together,** and a page sits just before the pages that build on it. Case: Suspense after Async atoms; Services just before Mutations and RPC.
- **A primer goes at the point of first need,** with a line for readers who can skip it. Case: Effect basics opens Async.
- **Pages that compare themselves with each other sit next to each other,** and a primitive unlike its neighbours ends its section. Case: Families and Scoped atoms; AtomRef last in Atoms.
- **A page for one audience gets a link from where that audience arrives.** Case: Migrating from atom-react, linked from the Introduction.
- **Topics readers meet early aren't left in Guides.** Case: Errors moved to the end of Async.

## 5. Order within each page

Apply `improve-docs-page`'s rubric item 1 to every page. The first review skipped this on its first pass; these are the shapes it then found:

- A section uses an option or term that a section further down explains (Suspense's `suspendOnWaiting` and server value).
- A table of hooks comes after the examples that use them (AtomRef).
- The basic use comes after an edge case (reading a family, after key equality).
- Customizing comes before basic use (HTTP's `transformClient` before its first query).
- An example's button relies on a section further down (Async atoms' refresh).

After reordering, search the page for "above" and "below".

## 6. Shown code

- **Run `scripts/code-size.mjs`.** Pages whose example sources dwarf their prose need trimming more than their snippets do.
- **Apply `improve-docs-page`'s rubric item 5 to every example,** above all the first 14 lines, code a page doesn't teach, and snippets that repeat the example below them.

## 7. Weak demonstrations

- **Apply `improve-docs-page`'s non-negotiables to every example,** not only the ones you suspect. Case: Errors' main example used a `<select>` and a string helper instead of `CauseView`.
