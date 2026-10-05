# Changesets

Run `bun run changeset` for each change to the library that users should know about, and commit the generated file with the change. `bun run version-packages` turns them into version bumps and `CHANGELOG.md` entries.

## Releasing

`.github/workflows/release.yml` runs after CI passes on `main`. While there are changesets, it keeps a "chore: version packages" PR open with the version bump and changelog. Merging that PR starts the publish job, which waits for a reviewer of the `npm` environment to approve it on the workflow run. Once approved, it publishes the new version to npm through npm trusted publishing, with a GitHub release and a git tag.
