---
name: writing-guidelines
description: Write a new doc, or review docs and prose against the Writing Guidelines. Use when asked to write documentation, "review my docs", "check writing style", "audit prose", or "check this page against the writing handbook".
argument-hint: <file-or-pattern>
---

# Writing Guidelines

## The guidelines

Fetch them fresh, with WebFetch, before each use:

```
https://raw.githubusercontent.com/vercel-labs/writing-guidelines/main/command.md
```

The fetched content holds every rule and the review's output format.

## Writing a new doc

A doc serves one reader goal, so it is one of four types ([Diátaxis](https://diataxis.fr/)). Pick the type before writing, and keep the doc to it:

- **Tutorial**: a lesson. Practical steps that take a newcomer to a working result.
- **How-to guide**: a recipe. The steps that solve one specific problem.
- **Reference**: a dictionary. Technical descriptions of the machinery, consulted on demand.
- **Explanation**: a discussion. Why it is the way it is, for understanding.

Material of another type goes in its own doc, linked. Write to the guidelines, in the repo's existing terms (`GLOSSARY.md`) and tone, then review the draft as below.

## Reviewing

1. Read the files named (if none were, ask which).
2. Check them against every rule in the guidelines.
3. Output the findings in the terse `file:line` format the guidelines give.
