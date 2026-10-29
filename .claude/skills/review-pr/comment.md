# The review comment

Render it from the reviewer's `json` block and every round's Fixed rows. The repo's review-comment command does this when it has one.

````markdown
<!-- review-pr -->

## Confidence Score: <score>/5

**[<impact> impact]** <the reviewer's one-line verdict>

| Subscore       | Score         | Why      | To reach 5                     |
| -------------- | ------------- | -------- | ------------------------------ |
| Spec           | <dot> <score> | <reason> | <the change that gets it to 5> |
| Design         | <dot> <score> | <reason> | <the change that gets it to 5> |
| Implementation | <dot> <score> | <reason> | <the change that gets it to 5> |
| Stability      | <dot> <score> | <reason> | <the change that gets it to 5> |
| Security       | <dot> <score> | <reason> | <the change that gets it to 5> |

### Decisions

1. **<finding>** (<axis>, [`path:line`](<link to path#Lline at sha>)): <options>. Recommended: <option>.

### Summary

<the reviewer's summary>

<details>
<summary>Fixed (<count>)</summary>

| Round | Axis   | Finding   | Resolution                   |
| ----- | ------ | --------- | ---------------------------- |
| <k>   | <axis> | <finding> | <commit>, or rebutted: <why> |

</details>

<sub>Round <k> · <tier> (<model>, <effort>): <tier reason> · reviewed at <sha></sub>

<!-- review-pr-state: {"round": <k>, "sha": "<sha>", "tier": "<tier>", "context": "<the reviewer's context>", "open": [<open decisions>]} -->
````

- The score is the lowest subscore, n/a counting as 5.
- The dot is 🟢 for 5, 🟡 for 4, 🟠 for 3, 🔴 for 2 or 1, and ⚪ for n/a.
- Leave a "To reach 5" cell empty at 5 or n/a, and drop the column when every subscore is 5 or n/a.
- Link each `path:line` to the sha the reviewer read, where its line numbers come from.
- Escape `|` as `\|` inside a table cell. Prefix a nit's finding with `(nit)`.
- Drop a section that has nothing in it.
- The hidden state line carries the round, sha and context to the next round, so a delta round works from the comment alone.

## Posting it by hand (GitHub)

Write the body to a file, then update the comment, or post it in round 1:

```sh
id=$(gh api "repos/{owner}/{repo}/issues/<n>/comments" --paginate --jq '.[] | select(.body | startswith("<!-- review-pr -->")) | .id' | head -1)
if [ -n "$id" ]; then gh api -X PATCH "repos/{owner}/{repo}/issues/comments/$id" -F body=@<file>; else gh pr comment <n> --body-file <file>; fi
```
