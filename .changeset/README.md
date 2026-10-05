# Changesets

Run `bun run changeset` for each change to the library that users should know about, and commit the generated file with the change. `bun run version-packages` turns them into version bumps and `CHANGELOG.md` entries.

## Releasing

`.github/workflows/release.yml` runs after CI passes on `main`. While there are changesets, it keeps a "chore: version packages" PR open with the version bump and changelog. Merging that PR publishes the new version to npm, with a GitHub release and a git tag, through npm trusted publishing.
