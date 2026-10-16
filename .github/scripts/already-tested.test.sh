#!/usr/bin/env bash
# Tests already-tested.sh's file checks against commits in a scratch repo. CI's scope job runs it
# before it trusts the script.
set -euo pipefail

script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/already-tested.sh"
# shellcheck source=already-tested.sh
source "$script"

repo=$(mktemp -d)
trap 'rm -rf "$repo"' EXIT
cd "$repo"
git init --quiet
# CI's runner has no git identity; elsewhere, keep the one configured.
git config user.name >/dev/null || git config user.name test
git config user.email >/dev/null || git config user.email test@example.com
git config commit.gpgsign false

mkdir -p packages/lib/src docs .changeset
printf '{\n  "name": "effect-atom-svelte",\n  "version": "0.4.0",\n  "dependencies": {\n    "effect": "4.0.5"\n  }\n}\n' >packages/lib/package.json
printf '{\n  "workspaces": {\n    "packages/lib": {\n      "name": "effect-atom-svelte",\n      "version": "0.4.0",\n    },\n  },\n}\n' >bun.lock
echo 'export const a = 1;' >packages/lib/src/index.ts
echo '# Changelog' >packages/lib/CHANGELOG.md
echo 'notes' >docs/notes.md
echo 'a change' >.changeset/fix.md
git add -A
git commit --quiet -m base
base=$(git rev-parse HEAD)

failures=0
# expect <untested|tested> <name>: checks the working tree's change against the base commit.
expect() {
  git add -A
  git commit --quiet --allow-empty -m "$2"
  local got=tested
  if untested_diff "$base"; then
    got=untested
  fi
  if [ "$got" = "$1" ]; then
    echo "ok: $2"
  else
    echo "FAIL: $2 (expected $1, got $got)"
    failures=$((failures + 1))
  fi
  git reset --quiet --hard "$base"
}

expect untested "no change"

echo 'more notes' >>docs/notes.md
expect untested "a docs change"

echo '## 0.4.1' >>packages/lib/CHANGELOG.md
git rm --quiet .changeset/fix.md
sed -i.bak 's/"0.4.0"/"0.4.1"/' packages/lib/package.json bun.lock && rm ./*.bak packages/lib/*.bak
expect untested "a version bump, as the Version Packages PR makes"

echo 'export const b = 2;' >>packages/lib/src/index.ts
expect tested "a source change"

git mv packages/lib/src/index.ts docs/index.ts
expect tested "a source file moved into docs/"

sed -i.bak 's/"4.0.5"/"4.0.6"/' packages/lib/package.json && rm packages/lib/*.bak
expect tested "a dependency change in package.json"

# Larger than a pipe's buffer, so a reader that stops early would break the pipe.
for i in $(seq 1 20000); do
  echo "    \"pkg-$i\": [\"pkg-$i@1.0.0\", \"\", {}, \"sha512-$i\"],"
done >>bun.lock
expect tested "a large bun.lock change"

if [ "$failures" -gt 0 ]; then
  echo "$failures failed"
  exit 1
fi
