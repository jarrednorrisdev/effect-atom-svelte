# Ship mode

mode: <fast|properly>

<For fast: "Ship fast: tickets code ahead into a release branch, reviews are the gate, and the build and full tests run once per release." For properly: "Ship properly: every ticket lands on main as its own PR through the full landing check, with semver releases." Delete everything below for properly.>

Ship fast is defined in `ship`'s `fast.md`. This repo's specifics:

## Releases

- **Release branch**: `release/vX.Y.Z`; feeders `release/vX.Y.Z-<name>`.
- **Compile check**: `<the cheap whole-repo check, such as cargo check --workspace or tsc -b>`, about <n> minutes.
- **Full run**: `<the build, lint and whole test suite>`, about <n> minutes.
- **Small-fix land**: the Land command with only the fix's own tests after `--`: `<command>`.
- **Tag**: `<command that tags and pushes vX.Y.Z>`.
- **Release notes**: `<command that lists the milestone's closed tickets>`, written to `<a release on the host, or a CHANGELOG>`.
- **Deploy**: <what deploys and from where; it takes only a tag>, or none.

## Time budget

- A ticket runs only the tests it writes or changes: at most <3> minutes.
- <3> to <10> minutes of build or test needs Jarred's ok, such as <a per-crate cargo check>.
- Over <10> minutes runs only in release prep, or when Jarred asks.
