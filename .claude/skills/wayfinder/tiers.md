# Model tiers

Work runs on the smallest model that can do it well. A ticket's `model:<tier>` label sets the model that **works the ticket** and the one that **reviews its PR** (the repo's `docs/agents/tiers.md` lists the areas always reviewed on Opus).

## The tiers

| Tier | Model id | Effort | Launch `options` |
| --- | --- | --- | --- |
| haiku | `claude-haiku-5-5` | high, always | `[{ id: "effort", value: "high" }]` |
| sonnet | `claude-sonnet-5-5` | its default | none: leave `options` out |
| opus | `claude-opus-5-5` | medium | `[{ id: "effort", value: "medium" }]` |

If an id has gone from `orchestrator_capabilities`' list, stop and tell Jarred rather than guess a replacement.

## Choosing a ticket's tier

Set exactly one `model:*` label, the first row that fits, and end the body with a one-line reason: `Tier: sonnet, a contained change to the frontier query.`

- **opus**: medium and up.
  - Every **grilling** and **prototype** ticket: they're design conversations.
  - Architecture and design decisions, front-end look and feel, and a ticket whose job is to split work.
  - Anything spanning more than one area (a package, a feature, or a doc set: the documents about one design area). One feature's folders across packages are one area once its design is settled by an ADR or a decided ticket.
  - Anything in one of the repo's high-risk areas, listed in its `docs/agents/tiers.md`.
- **sonnet**: small. A contained change in one area, or a straightforward research question. Split work until most tickets land here.
- **haiku**: tiny. A one-line fix, a rename, a typo, a label or config tweak.

When unsure between two tiers, take the larger: a child that finds its ticket too big stops and costs a relaunch, but one that's over-powered just costs a little more.

## Launching on the tier

Launch each ticket's thread with `t3_thread_launch` and a `modelSelection` from the table, on the Claude JND instance, named explicitly:

```json
{
  "instanceId": "<the Claude JND instanceId>",
  "model": "claude-haiku-5-5",
  "options": [{ "id": "effort", "value": "high" }]
}
```

Call `orchestrator_capabilities` once per session for the instance ids (it prints about 10k tokens), and again only when a launch fails. Never let a launch fall to another provider. The launch message's first line states the tier: `Tier: haiku (claude-haiku-5-5, high effort).` A research ticket run as a subagent uses the same model and effort.

**A usage limit.** When a launch or dispatch fails with a rate or usage limit, that instance is out: pick the other Claude instance (`driverKind` `claudeAgent`) and retry once with it named explicitly, under a new `clientRequestId`. Say in your report which instance ran it and why. If that fails too, tell your parent, otherwise Jarred.

## A ticket bigger than its tier

A child that finds its ticket bigger than its tier doesn't carry on under-powered:

1. It stops before making changes it can't finish well.
2. It moves the ticket one tier up and comments on the ticket why, in a line or two.
3. It reports to its parent, which relaunches the ticket on the new tier.

Opus is the top tier: a ticket too big for it is too big for one ticket, so the child reports that and the coordinator splits it.

A child that finds its tier was more than the work needed finishes the ticket, and may suggest a lower tier for similar tickets in its report.
