# Streamlined Self-Build Implementation Plan

**Goal:** Add a self-build script that auto-resolves the upstream base version and runs the patched build with minimal manual steps.

**Architecture:** Create a new Bun script under `packages/opencode/script` that resolves the base version from env or latest git tag, sets build env, and invokes the existing `script/build.ts`. Expose it via package.json scripts and update the handoff docs.

**Tech Stack:** Bun, TypeScript, git, existing build script (`packages/opencode/script/build.ts`)

**Commit Intent:** per-task

**Execution Decision:** `superpowers:subagent-driven-development`

---

### Task 1: Add TDD coverage for self-build helpers

**Depends on:** None
**Parallelizable:** no
**Shared State:** None

**Files:**

- Create: `packages/opencode/test/script/self-build.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, test } from "bun:test"
import { buildArgs, versionFromTags } from "../../script/self-build"

describe("self-build helpers", () => {
  test("versionFromTags strips v prefix", () => {
    const value = versionFromTags("v0.1.48\nv0.1.47")
    expect(value).toBe("0.1.48")
  })

  test("versionFromTags returns empty on no tags", () => {
    const value = versionFromTags("\n")
    expect(value).toBe("")
  })

  test("buildArgs prepends build command", () => {
    const args = buildArgs(["--baseline"])
    expect(args).toEqual(["run", "script/build.ts", "--single", "--baseline"])
  })
})
```

**Step 2: Run test to verify it fails**

Run (from `packages/opencode`): `bun test test/script/self-build.test.ts`
Expected: FAIL because `../../script/self-build` does not exist yet.

**Step 3: Write minimal implementation**

- Create `packages/opencode/script/self-build.ts` with exported `versionFromTags` and `buildArgs` functions.
- Guard runtime execution with `if (import.meta.main)` and keep helper exports side-effect free.

**Step 4: Run test to verify it passes**

Run (from `packages/opencode`): `bun test test/script/self-build.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add test/script/self-build.test.ts script/self-build.ts
git commit -m "test: add self-build helper coverage"
```

### Task 2: Implement the self-build script main flow

**Depends on:** Task 1
**Parallelizable:** no
**Shared State:** None

**Files:**

- Modify: `packages/opencode/script/self-build.ts`

**Step 1: Write the failing test**

- No new tests required beyond Task 1 (helpers already cover tag parsing and arg construction).

**Step 2: Run test to verify it fails**

- Not applicable.

**Step 3: Write minimal implementation**

- Resolve `OPENCODE_VERSION` from env or the latest `v*` git tag.
- Default `OPENCODE_CHANNEL` to `latest` unless already set.
- Default `OPENCODE_DISABLE_AUTOUPDATE` to `1` unless already set.
- Invoke `bun run script/build.ts --single` plus any extra args.

**Step 4: Run test to verify it passes**

Run (from `packages/opencode`): `bun test test/script/self-build.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add script/self-build.ts
git commit -m "feat: add self-build script flow"
```

### Task 3: Wire scripts into package.json

**Depends on:** Task 2
**Parallelizable:** no
**Shared State:** None

**Files:**

- Modify: `packages/opencode/package.json`
- Modify: `package.json`

**Step 1: Add scripts**

- Add `self-build` to `packages/opencode/package.json`:
  - `"self-build": "bun run script/self-build.ts"`
- Add `self-build` to root `package.json`:
  - `"self-build": "bun run --cwd packages/opencode self-build"`

**Step 2: Commit**

```bash
git add package.json packages/opencode/package.json
git commit -m "chore: add self-build scripts"
```

### Task 4: Update the patched build handoff docs

**Depends on:** Task 3
**Parallelizable:** no
**Shared State:** None

**Files:**

- Modify: `docs/guides/patched-build-handoff.md`
- Modify: `CONTRIBUTING.md`

**Step 1: Update command examples**

- Replace manual env + build command with `bun run self-build` (and mention optional env overrides).
- Update “Building a localcode” section to reference `bun run self-build`.

**Step 2: Commit**

```bash
git add docs/guides/patched-build-handoff.md CONTRIBUTING.md
git commit -m "docs: streamline self-build instructions"
```
