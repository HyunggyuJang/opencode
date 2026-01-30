import { describe, expect, test } from "bun:test"
import {
  autoupdateFromEnv,
  buildArgs,
  channelFromEnv,
  gitArgs,
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
