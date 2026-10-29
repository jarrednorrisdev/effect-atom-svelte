# Bug hunts

What `hunt-bugs` needs to know about this repo. Add to the areas what each loop teaches.

- **Run one test**: `<command> <file> -t "<name>"`.
- **Promises**: the behaviour the code promises lives in `<API comments, docs pages, README>`.
- **Compare with**: `<a comparable library, or none>`. If it behaves the same way, the behaviour is probably intended.
- **Upstream**: `<dependencies whose behaviour the repo inherits>`.
- **Never mutate in place**: `<files a red-test proof must copy rather than edit, or none>`.

## Areas

One hunter per area: the code, then the questions that found bugs before.

### <Area name>

`<paths>`

- <question>
