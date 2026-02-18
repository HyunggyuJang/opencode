import { describe, expect, test } from "bun:test"
import path from "path"
import { Instance } from "../../src/project/instance"
import { TaskTool } from "../../src/tool/task"

const root = path.join(__dirname, "../..")

describe("tool.task description", () => {
  test("mentions task_id reuse and task_result output", async () => {
    await Instance.provide({
      directory: root,
      fn: async () => {
        const tool = await TaskTool.init()
        expect(tool.description).toContain(
          "The tool output starts with task_id and wraps the subagent response in <task_result>; metadata.sessionId also contains the same session id.",
        )
      },
    })
  })
})
