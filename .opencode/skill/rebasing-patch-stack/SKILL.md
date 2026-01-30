---
name: rebasing-patch-stack
description: Use when rebasing a patch branch or patch stack onto the latest upstream tagged release in this repo, especially when maintaining `patch/*` branches tied to `v*` tags.
---

# Rebasing Patch Stack

## Overview

Keep the patch stack small, rebase onto the latest upstream tag with `--rebase-merges`, and use rerere locally so conflicts are repeatable without changing global git config.

## When to Use

- Moving `patch/*` branches to the newest upstream `v*` tag
- Patch branches include merge commits that must be preserved
- You need a quick, repeatable rebase without force-pushing by default

Do not use this for creating new patches or when the base is not a tagged release.

## Core Pattern

Before (ad hoc):

```sh
git tag | tail -n 1
git rebase <tag>
git push --force
```

After (streamlined):

```sh
git fetch upstream --tags
tag="$(git tag --list 'v*' --sort=-v:refname | head -n 1)"
git -c rerere.enabled=true rebase --rebase-merges "$tag"
```

## Quick Reference

| Step            | Command                                                       |
| --------------- | ------------------------------------------------------------- |
| Pick remote     | `git remote -v` (prefer `upstream` if present)                |
| Fetch tags      | `git fetch <remote> --tags`                                   |
| Latest tag      | `git tag --list 'v*' --sort=-v:refname \| head -n 1`          |
| Latest patch    | `git branch --list 'patch/v*' --sort=-v:refname \| head -n 1` |
| New patch name  | `patch/<tag>` (match the upstream tag)                        |
| Create branch   | `git switch <patch> && git switch -c patch/<tag>`             |
| Rebase          | `git -c rerere.enabled=true rebase --rebase-merges <tag>`     |
| Conflict signal | `Patch needs resolution for <tag>` (only on conflict)         |
| Build check     | `bun run self-build`                                          |

## Implementation

```sh
# 1) Select the remote
remote="$(git remote | grep -x upstream || git remote | head -n 1)"

# 2) Fetch tags and choose the latest v* tag
git fetch "$remote" --tags
tag="$(git tag --list 'v*' --sort=-v:refname | head -n 1)"
test -n "$tag" || { echo "No upstream tags found"; exit 1; }

# 3) Start from the latest patch branch, keep it intact
patch="$(git branch --list 'patch/v*' --sort=-v:refname | head -n 1)"
test -n "$patch" || { echo "No patch/v* branches found"; exit 1; }
git switch "$patch"

# 4) Create a new patch branch named for the tag
next="patch/$tag"
git switch -c "$next"

# 5) Rebase with merge preservation and rerere
git -c rerere.enabled=true rebase --rebase-merges "$tag"

# 6) If conflicts happen, print:
# Patch needs resolution for <tag>
```

## Example

```sh
git fetch upstream --tags
git checkout patch/v0.1.48
git switch -c patch/v0.1.49
git -c rerere.enabled=true rebase --rebase-merges v0.1.49
```

## Common Mistakes

- Skipping tag fetch and rebasing on stale tags
- Using `git rebase` without `--rebase-merges` on patch branches with merges
- Enabling rerere globally when a one-off `-c rerere.enabled=true` is enough
- Picking the latest tag without filtering `v*` or sorting by version
- Force-pushing before verifying the rebased branch
- Using `git add -A` during conflict resolution without checking status

## Rationalization Table

| Excuse                                              | Reality                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| "I can use `git describe --tags upstream`"          | It is not reliable for the latest release tag. Use sorted `v*` tags. |
| "A plain rebase is fine"                            | Merge commits are lost without `--rebase-merges`.                    |
| "I should turn on rerere globally"                  | Use `git -c` for a local, reversible run.                            |
| "I can push --force-with-lease as part of the flow" | Pushing is optional and only after validation.                       |

## Red Flags - Stop and Re-check

- No `git fetch <remote> --tags` before picking the tag
- Latest tag chosen without `v*` filter and version sort
- Rebase run without `--rebase-merges` on a merge-heavy patch branch
- Conflicts resolved but no `Patch needs resolution for <tag>` marker emitted
- Force-push suggested before verifying build output
