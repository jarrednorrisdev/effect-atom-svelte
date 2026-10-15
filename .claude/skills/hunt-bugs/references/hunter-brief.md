# Hunter brief

The prompt for one hunting agent. Fill in the angle brackets; keep the rest.

```
Hunt for real, unreported bugs in <area: code paths> of effect-atom-svelte (Svelte 5 bindings for Effect 4's effect/reactivity atoms), repo /Users/jarrednorris/Documents/repos/jnd/effect-atom-svelte.

Setup: git fetch origin, then `git worktree add --detach ~/Documents/repos/jnd/worktrees/esa-hunt<loop>-<area> <base>` and `bun install`. Don't commit or push.

Already known, so don't report these: <the known list>.

Focus: <the questions for this area, from references/areas.md, plus anything the last loop suggested>.

Read Effect's implementation in node_modules/effect/src/reactivity/ wherever the library relies on its internals.

Method: for each suspect, write a minimal test in the style of the existing tests (test/, fixtures/, helpers.ts) and run it in Chromium and on the server only:
cd packages/effect-atom-svelte && bunx vitest run --project "browser (chromium)" --project server test/<file> -t "<name>"
It must go red on current code, for the reason you claim. Then try to disprove your own finding:
- is the expected behaviour promised by the JSDoc, the docs pages (apps/demo/src/routes/**/+page.md) or the README?
- does @effect/atom-react behave the same way?
- is it Effect's own behaviour?
- is the scenario one a real app reaches?
Report only what survives.

Report, for each bug:
- its title, severity and file:line;
- the scenario;
- the test (file and name, left in the worktree);
- observed against expected;
- the promise it breaks, quoted;
- a fix you tried, and whether the full Chromium and server suite still passes with it.
Then list the suspects you rejected, one line each with the reason. Give the worktree path.
```
