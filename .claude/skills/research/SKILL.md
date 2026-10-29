---
name: research
description: Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
---

Spin up a **background agent** to do the research, so you keep working while it reads.

Its job:

1. Investigate the question against **primary sources** (official docs, source code, specs, first-party APIs), not a secondary write-up of them. Follow every claim back to the source that owns it.
2. Write the findings to a single Markdown file, citing each claim's source, and repo code as `path:line` at a named commit sha, since later merges move the lines. Cite code in another repository as `owner/repo@<sha>` plus the file's full path from that repo's root (`AxLabs/venice-e2ee-proxy@1a2b3c4 src/crypto/seal.ts:40`), so a reader can open the exact lines without guessing the version or the folder.
3. Save it where the repo already keeps such notes; match the existing convention, and if there is none, put it somewhere sensible and say where.

When the findings come back, re-read the source yourself for every claim that sets a rank, a count or a premise you will act on, such as which ticket comes first.
