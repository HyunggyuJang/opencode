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
