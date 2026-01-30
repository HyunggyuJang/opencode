# OpenCode Patched Build Handoff

## Goal

Maintain a small patch stack on top of upstream tags, build a patched binary without new dependencies, and show the upstream base version in `opencode --version`.

## Current Context

- `opencode --version` uses `Installation.VERSION`, which is compile time `OPENCODE_VERSION` (`packages/opencode/src/installation/index.ts:182`).
- `OPENCODE_VERSION` and `OPENCODE_CHANNEL` are defined in `packages/opencode/script/build.ts:157` using `@opencode-ai/script` (`packages/script/src/index.ts:19`).
- If `OPENCODE_VERSION` is not set, preview builds use a `0.0.0-<channel>-<timestamp>` version (`packages/script/src/index.ts:32`).

## Worktree Setup (pick one location)

### Global worktree (no .gitignore change)

```bash
git fetch --all --tags
git worktree add ~/.config/superpowers/worktrees/opencode/patch-stack -b feature/patch-stack dev
```

### Project-local worktree (ensure ignored)

```bash
git fetch --all --tags
mkdir -p .worktrees
git worktree add .worktrees/patch-stack -b feature/patch-stack dev
```

## Patch Stack Workflow

1. Choose the upstream base tag, for example `v0.1.48`.
2. Create a patch branch from the tag, or rebase your existing patch branch onto it.
3. Keep patch commits small and focused to reduce conflicts.
4. When a new upstream tag lands, rebase the patch branch onto the new tag.
5. If a patch fails to apply, stop and print:

```
Patch needs resolution for <upstream-version>
```

Example flow:

```bash
# Set base tag
git fetch upstream --tags
git checkout -b patch/v0.1.48 v0.1.48

# Apply your patch commits (example: cherry-pick from existing branch)
git cherry-pick <patch-commit-1> <patch-commit-2>

# Move to a new upstream version
git fetch upstream --tags
git checkout patch/v0.1.48
git rebase --rebase-merges v0.1.49
```

To reuse conflict resolution without changing git config, use:

```bash
git -c rerere.enabled=true rebase --rebase-merges v0.1.49
```

## Build With Base Version Displayed

Build the patched binary with the upstream base version injected:

```bash
OPENCODE_VERSION=0.1.48 OPENCODE_CHANNEL=latest bun run ./packages/opencode/script/build.ts --single
```

This sets `opencode --version` to `0.1.48` instead of a preview tag.

## Autoupdate Behavior

Disable auto update to prevent upgrade prompts:

```bash
OPENCODE_DISABLE_AUTOUPDATE=1
```

## Key Files

- Version derivation: `packages/script/src/index.ts:19`
- Build defines: `packages/opencode/script/build.ts:157`
- Version usage: `packages/opencode/src/installation/index.ts:182`
