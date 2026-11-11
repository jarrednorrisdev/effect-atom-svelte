# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root, or
- **`GLOSSARY-MAP.md`** at the repo root if it exists: it points at one `GLOSSARY.md` per context. Read each one relevant to the topic.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `domain-modeling` skill creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (most repos):

```
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Multi-context repo (presence of `GLOSSARY-MAP.md` at the root):

```
/
├── GLOSSARY-MAP.md
├── docs/adr/                          ← system-wide decisions
└── src/
    ├── ordering/
    │   ├── GLOSSARY.md
    │   └── docs/adr/                  ← context-specific decisions
    └── billing/
        ├── GLOSSARY.md
        └── docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_

## Amending an ADR

When a decision changes a rule an existing ADR states, the thread recording it does all three steps:

1. **Write the amendment into the ADR**, leaving the old text in place:
   - a dated section after the opening paragraph, `## Amended YYYY-MM-DD: <what changed>`, with the new rule and why;
   - an inline pointer where each rule it changes stands, `**Amended YYYY-MM-DD** (above): <the new rule in one sentence>`;
   - when another ADR does the amending, a first line in the amended one, `**Amended in part by ADR NNNN (YYYY-MM-DD).** <what changes>`.
2. **Point every restatement at it.** Grep the changed rule's key phrases (its terms, numbers and names) across `docs/adr/`, `GLOSSARY.md`, `CONTRIBUTING.md` and the docs site's pages (`apps/demo/src/routes/**/+page.md`). Give each hit an inline pointer as above, or rewrite it where it only summarises. Done when a grep of each phrase finds only text that agrees with the amendment or points at it.
3. **Edit the open tickets it changes.** When the amendment changes behaviour an open ticket's body states, edit that body to the new behaviour, naming the amendment: the next agent reads the body, and a comment below it is easy to miss.

An ADR records decisions, so it has no "Open questions" section. A question it leaves open goes on a ticket, and the ADR names that ticket where the rule would stand; the amendment that settles it replaces the pointer.

## Decision log

Decisions too small for an ADR (a coordinator's answer, an auto-accepted grilling round) go in `docs/decisions.md`, numbered `D<n>`, newest last. Each entry is two or three lines: the number, the date, the ticket or PR link, the question, the choice and why, and who decided it (`Jarred`, `decided by <thread> for Jarred`, or `auto-accepted`; `to review` when Jarred should look at it). Jarred vetoes an entry by replying to it; the veto becomes a ticket that reverses it.
