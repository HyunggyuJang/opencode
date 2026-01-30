import { describe, expect, test } from "bun:test"
import { SystemPrompt } from "../../src/session/system"

describe("session.system.instructions", () => {
  test("returns provided prompt when set", () => {
    const prompt = "Test agent prompt"
    const result = SystemPrompt.instructions(prompt)
    expect(result).toBe(prompt)
  })

  test("returns codex header when prompt missing", () => {
    const result = SystemPrompt.instructions()
    expect(result.startsWith("You are OpenCode")).toBe(true)
  })
})
