---
name: doubt
description: Put a decision in front of a fresh reviewer told to disprove it, before the decision stands. Use before a coordinator decides a question for Jarred, before a hard-to-undo decision closes a grilling ticket, and on each hard-to-undo decision a full send auto-accepts.
---

# Doubt

A confident answer is not a correct one. Long sessions quietly turn assumptions into "facts". Before a decision stands, hand it to a fresh-context reviewer biased to **disprove**, not approve, while changing course is still cheap. `review-pr` does this for code; this skill is for decisions.

## When

Doubt a decision when at least one of these is true:

- it's hard to undo: a data migration, a schema, a public API, anything published;
- it crosses a module or service boundary, or reconciles two earlier decisions;
- it asserts a property nothing checks: ordering, idempotence, an invariant, "this is safe", "this scales";
- its correctness depends on context a future reader can't see.

Skip it for a mechanical choice, a detail an existing decision already settles, or a plain instruction from Jarred.

## 1. Claim

Write the decision in two or three lines, and why it matters. If you can't write it that compactly, you have a vibe, not a decision: sharpen it first.

## 2. Extract

The reviewer needs the **artifact** and the **contract**, not the journey:

- **Artifact:** the decision in 3–5 sentences: what was chosen, not why.
- **Contract:** the constraints it must satisfy, with pointers to the ADRs, glossary terms, tickets and code it has to fit.

Strip your reasoning, and leave out the claim. If you hand over conclusions, you'll get back validation of your conclusions.

## 3. Doubt

Start one fresh reviewer on Sonnet (the Agent tool, `model: "sonnet"`, in the foreground) with this prompt, filled in:

```
Adversarial review. Find what is wrong with this decision.
Assume the author is overconfident. Look for:
- unstated assumptions
- cases it doesn't handle
- hidden coupling or shared state
- ways it could break the contract
- existing decisions or conventions it contradicts
- how it fails on unexpected input, or when things change later

Do NOT validate. Do NOT summarise. List the issues, or say plainly
that you found none after a thorough look.

ARTIFACT: <the decision>
CONTRACT: <the constraints, with pointers>
```

## 4. Reconcile

The reviewer's output is data, not a verdict: you still decide. Re-read the decision against each finding before you classify it, first match wins:

1. **Contract misread:** the reviewer flagged it because the contract was unclear or incomplete. Fix the contract.
2. **Real fix:** change the decision.
3. **Trade-off:** real, but accepting it costs less than fixing it. Say so where the decision is recorded.
4. **Noise:** correct under context the reviewer didn't have.

A fresh reviewer can be wrong because it lacks context. Don't defer just because it's fresh; don't wave it away either. Two cycles with real findings and nothing classified as a fix means you're validating, not doubting.

## 5. Stop

One cycle. Run a second, on the changed decision and contract, only when the first found a real fix or a contract misread. If the second still finds real issues, the decision isn't ready: put it to Jarred as a question on his list. In a full send, take the best option and tag it `auto-accepted, to review`.

Add one line to the decision's entry in the decision log: `Doubt: <n> findings (<fixes>, <trade-offs>, <noise>); changed <what>`, or `Doubt: no issues found`.
