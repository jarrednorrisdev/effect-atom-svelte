# Explainer diagrams

What `explainer-diagram` needs to know about this repo.

- **Glossary**: `<path, e.g. docs/diagrams/glossary.mjs>`. One general definition per term; a diagram adds what's specific to it.
- **Real scenarios**: `<where the use cases live: docs pages, examples, demo routes>`.
- **Playwright**: run the screenshot script from `<a folder with Playwright installed>`.

## Publishing a PR's diagram

<!-- Where a built page goes so a PR can link it, or "nowhere: chat only". The GitHub Pages version: -->

1. A page's path holds the PR number, so open the PR (as a draft) before publishing.
2. Publish the page on the `pr-assets` branch, which shares no history with `main` and is never merged. From a worktree of that branch: `git pull -q`, copy the page to `pr/<number>/<slug>.html`, commit and push.
3. Pages serves it at `https://<owner>.github.io/<repo>/pr/<number>/<slug>.html` about a minute later. Wait until `curl -sI <url>` says `200` before linking it. A 404 that lasts: check Pages still serves the branch's root (`gh api repos/<owner>/<repo>/pages -q .source`).
