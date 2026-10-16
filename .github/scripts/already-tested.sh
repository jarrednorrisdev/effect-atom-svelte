#!/usr/bin/env bash
# Prints the first of the given commits that CI already passed on and that HEAD differs from only
# in files no test reads, and exits 0. Exits 1 when there is none, so CI runs the tests.
#
#   already-tested.sh <commit>...
#
# Needs the full history (fetch-depth: 0), and GH_TOKEN and GITHUB_REPOSITORY for the API.
set -euo pipefail

# Files no test, build or check reads: changelogs and changesets, agent and contributor docs.
# Package READMEs aren't here: they ship in the package.
untested_path() {
  case "$1" in
    CHANGELOG.md | */CHANGELOG.md | .changeset/* | .claude/* | docs/*) return 0 ;;
    AGENTS.md | CLAUDE.md | CONTRIBUTING.md | README.md | LICENSE) return 0 ;;
    *) return 1 ;;
  esac
}

# A package.json or bun.lock change that only moves this repo's own versions, as the Version
# Packages PR does: "version" fields, and ranges on the workspace packages.
version_lines_only() {
  local base=$1 file=$2
  ! git diff -U0 "$base" HEAD -- "$file" |
    grep -E '^[+-]' |
    grep -vE '^(\+\+\+|---) ' |
    grep -vqE '^[+-][[:space:]]*"(version|effect-atom-svelte|effect-atom-svelte-devtools)": "[^"]*",?$'
}

untested_diff() {
  local base=$1 file
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    if untested_path "$file"; then
      continue
    fi
    case "$file" in
      package.json | */package.json | bun.lock)
        version_lines_only "$base" "$file" && continue
        ;;
    esac
    return 1
  done < <(git diff --name-only "$base" HEAD)
}

# Whether a CI run on this commit succeeded. A run that skipped its tests this way counts: its
# own match had passed.
passed() {
  local count
  count=$(gh api "repos/$GITHUB_REPOSITORY/actions/workflows/ci.yml/runs?head_sha=$1&status=success" \
    --jq '.total_count')
  [ "$count" -gt 0 ]
}

for commit in "$@"; do
  # The API matches only a full sha.
  commit=$(git rev-parse --verify --quiet "$commit^{commit}") || continue
  if untested_diff "$commit" && passed "$commit"; then
    echo "$commit"
    exit 0
  fi
done
exit 1
