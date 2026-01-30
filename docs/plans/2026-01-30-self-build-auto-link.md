# Self-Build Auto-Link Implementation Plan

**Goal:** Auto-link the built `opencode` binary into `~/.local/bin` after `bun run self-build` completes.

**Architecture:** Extend `packages/opencode/script/self-build.ts` with pure path helpers (tested) plus a best-effort symlink step in the main flow on non-Windows platforms. Update docs to mention the auto-link behavior.

**Tech Stack:** Bun, TypeScript, Node fs/path/os

**Commit Intent:** per-task

**Execution Decision:** `superpowers:subagent-driven-development`

---

### Task 1: Add TDD coverage for auto-link helpers

**Depends on:** None
**Parallelizable:** no
**Shared State:** None

**Files:**

- Modify: `packages/opencode/test/script/self-build.test.ts`

**Step 1: Write the failing test**

```ts
import path from "path"
import { describe, expect, test } from "bun:test"
import { binaryName, binaryPath, linkPath, platformName } from "../../script/self-build"

describe("self-build linking", () => {
  test("platformName maps win32 to windows", () => {
    const value = platformName("win32")
    expect(value).toBe("windows")
  })

  test("binaryName uses .exe on win32", () => {
    const value = binaryName("win32")
    expect(value).toBe("opencode.exe")
  })

  test("binaryPath points to dist binary", () => {
    const value = binaryPath("/repo", "darwin", "arm64")
    expect(value).toBe(path.join("/repo", "dist", "opencode-darwin-arm64", "bin", "opencode"))
  })

  test("linkPath points to ~/.local/bin", () => {
    const value = linkPath("/home/me", "opencode")
    expect(value).toBe(path.join("/home/me", ".local", "bin", "opencode"))
  })
})
```

**Step 2: Run test to verify it fails**

Run (from `packages/opencode`): `bun test test/script/self-build.test.ts`
Expected: FAIL because helpers are missing.

**Step 3: Write minimal implementation**

- Add and export `platformName`, `binaryName`, `binaryPath`, and `linkPath` in `packages/opencode/script/self-build.ts`.

**Step 4: Run test to verify it passes**

Run (from `packages/opencode`): `bun test test/script/self-build.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/opencode/test/script/self-build.test.ts packages/opencode/script/self-build.ts
git commit -m "test: cover self-build auto-link helpers"
```

### Task 2: Implement auto-link in the self-build flow

**Depends on:** Task 1
**Parallelizable:** no
**Shared State:** None

**Files:**

- Modify: `packages/opencode/script/self-build.ts`

**Step 1: Write the failing test**

- No new tests required beyond Task 1.

**Step 2: Run test to verify it fails**

- Not applicable.

**Step 3: Write minimal implementation**

- After build completes, resolve the built binary path from `dist/` using the new helpers.
- If the binary is missing, log a warning and skip linking.
- On non-Windows platforms, create `~/.local/bin` and symlink the binary to `~/.local/bin/opencode`.
- Do not fail the build when linking fails; warn and continue.

**Step 4: Run test to verify it passes**

Run (from `packages/opencode`): `bun test test/script/self-build.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/opencode/script/self-build.ts
git commit -m "feat: auto-link self-build binary"
```

### Task 3: Document auto-link behavior

**Depends on:** Task 2
**Parallelizable:** no
**Shared State:** None

**Files:**

- Modify: `docs/guides/patched-build-handoff.md`
- Modify: `CONTRIBUTING.md`

**Step 1: Update documentation**

- Mention that `bun run self-build` auto-links the binary to `~/.local/bin/opencode` on macOS/Linux.
- Note that users should add `~/.local/bin` to their PATH if needed.

**Step 2: Commit**

```bash
git add docs/guides/patched-build-handoff.md CONTRIBUTING.md
git commit -m "docs: note self-build auto-link"
```
