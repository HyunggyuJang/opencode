import { describe, expect, test } from "bun:test"
import path from "path"
import { Instance } from "../../src/project/instance"
import { TaskTool } from "../../src/tool/task"

const root = path.join(__dirname, "../..")

describe("tool.task description", () => {
  test("mentions task_metadata session_id reuse", async () => {
    await Instance.provide({
      directory: root,
      fn: async () => {
        const tool = await TaskTool.init()
        expect(tool.description).toContain(
          "The tool output ends with <task_metadata> containing session_id; copy that value when resuming the same subagent.",
        )
      },
    })
  })
})
