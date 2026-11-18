# Model tiers

Every thread runs on Opus at medium effort unless its work is plainly one of the narrower kinds below (Jarred, 2026-11-13). A ticket's `model:<tier>` label sets the model that **works the ticket**; its PR is reviewed on `review-pr`'s tier.

## The tiers

| Tier | Label | Model id | Effort | Launch `options` |
| --- | --- | --- | --- | --- |
| opus | `model:opus` | `claude-opus-5-5` | medium | `[{ id: "effort", value: "medium" }]` |
| opus-low | `model:opus-low` | `claude-opus-5-5` | low | `[{ id: "effort", value: "low" }]` |
| sonnet | `model:sonnet` | `claude-sonnet-5-5` | medium | `[{ id: "effort", value: "medium" }]` |
| sonnet-low | none (subagents only) | `claude-sonnet-5-5` | low | `[{ id: "effort", value: "low" }]` |
| haiku | none (subagents only) | `claude-haiku-5-5` | high | `[{ id: "effort", value: "high" }]` |

If an id has gone from `orchestrator_capabilities`' list, stop and tell Jarred rather than guess a replacement.

## Choosing a tier

Set exactly one `model:*` label on a ticket, the first row that fits, and end the body with a one-line reason: `Tier: opus-low, a contained endpoint following the existing pattern.`

- **opus** (medium), the default: every coding ticket that isn't plainly easy, every grilling, prototype, research, review and coordinator thread, design and look-and-feel work, anything spanning areas or touching the repo's high-risk areas (its `docs/agents/tiers.md`).
- **opus-low**: easy coding tickets that still need a good coder's judgement: a contained change following an existing pattern, with its design already settled.
- **sonnet** (medium): only the tiniest, most mechanical work: a one-line fix, a rename, a typo, a label or config tweak, a docs edit.
- **sonnet-low**: a very simple web search or lookup, run as a subagent. Never coding.
- **haiku**: never coding. Only bulk retrieval and analysis run as a subagent: finding every instance of a snippet, sifting large logs or text, summarising a big dataset.

When unsure between two tiers, take the larger: a child that finds its ticket too big stops and costs a relaunch, but one that's over-powered just costs a little more.

## Launching on the tier

Launch each ticket's thread with `t3_thread_launch` and a `modelSelection` from the table, on the Claude instance you run on yourself, named explicitly:

```json
{
  "instanceId": "<your own instanceId>",
  "model": "claude-opus-5-5",
  "options": [{ "id": "effort", "value": "medium" }]
}
```

Call `orchestrator_capabilities` once per session: its `inheritedProviderInstanceId` is your instance (it prints about 10k tokens), and again only when a launch fails. Never let a launch fall to another provider. The launch message's first line states the tier: `Tier: opus (claude-opus-5-5, medium effort).` A subagent takes the tier of its work by the same rules: a research or search subagent is opus, sonnet-low or haiku by what it does, never by its parent's tier.

**A usage limit.** When a launch or dispatch fails with a rate or usage limit, that instance is out: pick the other Claude instance (`driverKind` `claudeAgent`) and retry once with it named explicitly, under a new `clientRequestId`. Say in your report which instance ran it and why. If that fails too, tell your parent, otherwise Jarred.

## A ticket bigger than its tier

A child that finds its ticket bigger than its tier doesn't carry on under-powered:

1. It stops before making changes it can't finish well.
2. It moves the ticket one tier up (sonnet → opus-low → opus) and comments on the ticket why, in a line or two.
3. It reports to its parent, which relaunches the ticket on the new tier.

Opus at medium is the top tier: a ticket too big for it is too big for one ticket, so the child reports that and the coordinator splits it.

A child that finds its tier was more than the work needed finishes the ticket, and may suggest a lower tier for similar tickets in its report.
