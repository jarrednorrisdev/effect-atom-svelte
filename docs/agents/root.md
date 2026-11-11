# The root thread

Settings the `root` skill and the wayfinders read on this machine.

- **Status**: `to write`. It prints the maps and how far along each is, running threads, threads and PRs waiting on Jarred, and the decisions tagged `to review`.
- **Capacity**: the cap on running ticket threads across all maps is the value below; `root` edits it when Jarred sets a new cap. Each thread has its own worktree, but a Playwright run starts its own demo API and preview server on fixed ports (`CONTRIBUTING.md`, "Tests"), so more than a few threads collide on ports and CPU.

  Capacity: 3

- **Timer gate**: `to write`.
- **Root state file**: `.cache/root/state.md`, untracked.
- **Decision log**: see `docs/agents/domain.md`.

## This machine

- Windows. A new worktree needs `bun install`, then the packages built (`bunx turbo run build --filter='./packages/*'`) and `bunx svelte-kit sync` run in `apps/demo`, before lint, check or the dev server work.
- The dev server runs on :5180 and the demo API on :3010. Start either as a background command with `timeout: 7200000`, since the default stops it after 30 minutes. Two worktrees running Playwright at once need `E2E_PORT_OFFSET=50` on one of them.
- `oxfmt` reflows files after edits: re-read a file before matching its text for another edit.
