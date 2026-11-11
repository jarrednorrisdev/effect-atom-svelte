---
name: setup-jnd
description: "Configure a repo for the jnd skills: write the docs/agents/ files they read (tracker and PR commands, domain docs and decision log, root thread settings, review checklist, high-risk areas). Run once per repo after syncing the skills in, and again to fill gaps."
---

# Setup jnd

The skills name a step; the repo's `docs/agents/` says how to do it here. This skill writes those files:

| File | Read by | Holds |
| --- | --- | --- |
| `issue-tracker.md` | `wayfinder`, `ship`, `file-pr`, `land-pr`, `review-pr` | the tracker's commands, the map and ticket operations, and the PR commands: open a draft, mark ready, land, the landing check |
| `domain.md` | every skill that names a domain concept, `domain-modeling` | the glossary and ADR layout, amending an ADR, the decision log |
| `root.md` | `root`, `wayfinder` | the status command, capacity setting, timer gate, and anything specific to this machine |
| `review.md` | `review-pr` | the repo's own checks, one bullet each |
| `tiers.md` | `wayfinder`, `ship`, `review-pr` | the repo's high-risk areas, which put a ticket on Opus, and the areas always reviewed on Opus |
| `hunt.md` | `hunt-bugs` | only when Jarred wants bug hunts: the areas, the one-test command, where the promises live |
| `diagrams.md` | `explainer-diagram` | only when Jarred wants diagrams: the glossary, real scenarios, Playwright, and where a PR's diagram is published |

Explore, present what you found, confirm with Jarred, then write. **Fill gaps only:** a file or section that already exists stays as it is, whatever it says. Offer a change to one only when it contradicts a skill. A doc in Matt's format (from `setup-matt-pocock-skills`) counts as existing: append the sections it lacks and fix its stale skill names. Update any protocol text that names a skill or step the stack replaces (an old claim command, "land with the user's go-ahead").

## 1. Explore

Read whatever exists; don't assume:

- `git remote -v`: GitHub, a self-hosted Forgejo, or neither? A Linear workspace named in `AGENTS.md` or `docs/`?
- `AGENTS.md` and `CLAUDE.md`: which exists, is there an `## Agent skills` section, and a "Stop and ask a human before" list?
- `GLOSSARY.md` and `GLOSSARY-MAP.md`, and the legacy `CONTEXT.md` / `CONTEXT-MAP.md`. If a legacy file exists, offer to `git mv` it to its `GLOSSARY` name.
- `docs/adr/`, any `src/*/docs/adr/`, and a decision log (a `D<n>` list in a doc or a pinned ticket).
- `docs/agents/`: what's already there.
- The repo's checks (`package.json` scripts, `Cargo.toml`, CI workflows), for the landing check and the review checklist.
- The tracker CLI: `gh`, `tea` or `linearis` on the PATH and logged in, and any labels the tracker requires on every issue (an area, a kind, a triage state).
- `.gitignore`: does it ignore `.cache/`?
- Hooks: `git config --get core.hooksPath`. A repo moved between drives can keep a path that no longer exists, and git then runs no hooks, silently.
- Line endings: `git ls-files --eol`. A Windows checkout with `core.autocrlf=true` has CRLF files over an LF index, which a formatter that enforces LF fails on every file.
- A `triage-labels.md` from Matt's setup: no jnd skill reads it.

## 2. Present and ask

Summarise what's present and what's missing, then one section at a time, each led by the recommended answer so Jarred can accept it in a word. Skip a section exploration already settled.

- **Tracker.** GitHub for a GitHub remote, Forgejo for a Forgejo one, Linear when the repo's work lives there. The PRs live on the git host either way.
- **Stop and ask a human before.** The actions no agent takes alone (force-pushing, deleting data, spending money, publishing). `ship` sends these to Jarred. Propose a list from the repo's rules.
- **Landing.** The **Land** command (merge `origin/main` into the branch, run the landing check on that tree, put the result on `main`) and the landing check: lint, format and typecheck of what changed. Propose both from the repo's checks, and run the proposed check once on a clean `origin/main` first: missing tools, a full disk or tests already red there would make every landing fail. Record a red baseline (the failing tests and their issue) in the tracker doc beside the check. On GitHub the Land command is `land-pr`'s `land-github.mjs`, on Forgejo its `land-forgejo.mjs`, each with the landing check after `--`.
- **Decision log.** Where decisions get D-numbers: propose `docs/decisions.md` when there's none.
- **Root.** The status command, where the capacity cap lives, and the timer gate. A command that doesn't exist yet is written as `to write`, not invented.
- **Required labels.** When the tracker requires its own labels on every issue, how they apply to map tickets. The answer goes into the tracker doc's child-ticket command.
- **Review checklist, high-risk areas and Review on Opus.** Propose a few bullets each from what you read; empty is fine. Review on Opus is usually a short subset of the high-risk areas.

## 3. Confirm and write

Show the drafts, let Jarred edit them, then write them from the templates beside this skill:

- [issue-tracker-github.md](issue-tracker-github.md), [issue-tracker-forgejo.md](issue-tracker-forgejo.md) or [issue-tracker-linear.md](issue-tracker-linear.md)
- [domain.md](domain.md), [root.md](root.md), [review.md](review.md), [tiers.md](tiers.md), plus [hunt.md](hunt.md) and [diagrams.md](diagrams.md) when asked

Fill every `<placeholder>`. Keep each file's line endings: a doc committed with CRLF stays CRLF. Run each tracker command's `--help` before writing it down: CLI flags change between versions, and an agent copies these commands unchecked. Create the labels the tracker lacks: `wayfinder:map`, `wayfinder:<research|prototype|grilling|task|build>`, `model:<haiku|sonnet|opus>`, `human:verify`.

Add `.cache/` to `.gitignore`: review briefs and reports, the sync merge folder and the root's state file live there. Leave `.claude/skills/**` out of the repo's lint, format and other file checks, in each tool's own ignore list (a linter and a formatter often have separate ones; an existing `.claude/**` ignore already covers it): the synced skills are vendored, and a local fix to one shows as a tweak the next time `sync.mjs` runs. When the checkout has CRLF files and the formatter enforces LF or a test compares checked-in files byte for byte, add a `.gitattributes` with `* text=auto eol=lf`, then `git add --renormalize .`. Git doesn't rewrite unchanged files in other worktrees, even after they merge that commit, so tell Jarred to refresh each existing clean worktree with `git rm --cached -r -q . && git reset --hard` (it discards uncommitted changes). Offer to delete a `triage-labels.md` no jnd skill reads.

Then add or update the block in whichever of `CLAUDE.md` / `AGENTS.md` exists (if neither, ask which to create; never create one beside the other). When there are more, the one a tool manages (a `turbo`-managed `AGENTS.md`) is canonical, the other root file is a one-line `@AGENTS.md`, and a nested `.claude/CLAUDE.md` is merged in and deleted, so nothing loads twice:

```markdown
## Agent skills

The jnd skills read this repo's settings from `docs/agents/`:

- Tracker and PRs: <one line>. See `docs/agents/issue-tracker.md`.
- Domain docs and decisions: <one line>. See `docs/agents/domain.md`.
- Root thread: see `docs/agents/root.md`. Review checklist: `docs/agents/review.md`. High-risk areas: `docs/agents/tiers.md`.

### Stop and ask a human before

- <each action, one bullet>
```

Write the Stop list only when the file has none. When the repo forbids attribution lines in commits or PRs, say so in this block too: every thread reads it, and the harness adds attribution unless told not to.

## 4. Done

Tell Jarred what was written and what's still `to write`. He can edit `docs/agents/` directly later; rerun this skill to fill new gaps.
