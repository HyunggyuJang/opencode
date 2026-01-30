import path from "path"
import { describe, expect, test } from "bun:test"
import {
  autoupdateFromEnv,
  binaryName,
  binaryPath,
  buildArgs,
  channelFromEnv,
  gitArgs,
  linkPath,
  linkAction,
  linkSpec,
  platformName,
  resolveVersion,
  versionFromTags,
} from "../../script/self-build"

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

  test("gitArgs uses tag-only describe", () => {
    const args = gitArgs()
    expect(args).toEqual(["describe", "--tags", "--match", "v*", "--abbrev=0"])
  })
})

describe("self-build env resolution", () => {
  test("resolveVersion prefers OPENCODE_VERSION", () => {
    const value = resolveVersion(
      {
        OPENCODE_VERSION: "0.1.99",
      },
      "v0.1.48\n",
    )
    expect(value).toBe("0.1.99")
  })

  test("resolveVersion falls back to git tags", () => {
    const value = resolveVersion({}, "v0.1.48\n")
    expect(value).toBe("0.1.48")
  })

  test("resolveVersion throws when no version is available", () => {
    const run = () => resolveVersion({}, "\n")
    expect(run).toThrow("No git tags found")
  })

  test("channelFromEnv defaults to latest", () => {
    const value = channelFromEnv({})
    expect(value).toBe("latest")
  })

  test("autoupdateFromEnv defaults to 1", () => {
    const value = autoupdateFromEnv({})
    expect(value).toBe("1")
  })
})

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

  test("linkSpec resolves source, dest, and dir", () => {
    const value = linkSpec("/repo", "/home/me", "darwin", "arm64")
    expect(value).toEqual({
      source: path.join("/repo", "dist", "opencode-darwin-arm64", "bin", "opencode"),
      dest: path.join("/home/me", ".local", "bin", "opencode"),
      dir: path.join("/home/me", ".local", "bin"),
    })
  })

  test("linkAction creates when no target", () => {
    const value = linkAction("/source", null)
    expect(value).toBe("create")
  })

  test("linkAction skips when target matches", () => {
    const value = linkAction("/source", "/source")
    expect(value).toBe("skip")
  })

  test("linkAction replaces when target differs", () => {
    const value = linkAction("/source", "/other")
    expect(value).toBe("replace")
  })
})
