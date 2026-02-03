---
name: opencode-prompt-adjustment
description: Use when adjusting OpenCode prompt templates or tool descriptions to change agent tool usage, resume behavior, or truncation-sensitive outputs.
---

# OpenCode Prompt Adjustment

## Overview

Prompt tweaks must match real tool behavior. Verify where prompts live, how tool output is truncated, and add tests that catch regressions.

## When to Use

- Agents ignore tool guidance or misuse parameters (ex: missing `session_id`).
- Prompt-only changes are requested for OpenCode (`task.txt`, system prompts, agent prompts).
- Behavior depends on tool output formatting or truncation.

## Core Pattern

1. **Locate prompt sources**
   - Tool prompts: `packages/opencode/src/tool/*.txt`
   - System prompts: `packages/opencode/src/session/prompt/*.txt`
2. **Verify tool behavior**
   - Check `Tool.define` truncation and any metadata tags (`<task_metadata>`).
   - Confirm whether the requested behavior is enforceable without code changes.
3. **Make the smallest prompt change**
   - Be explicit about where to read metadata and how to reuse it.
   - Avoid instructions that require impossible behavior (ex: “retry until no truncation”).
4. **Test the behavior**
   - Add a unit test for prompt/output formatting.
   - Add or run an integration script when LLM behavior is the surface.

## Quick Reference

| Goal                 | Where                                              | Check                                                |
| -------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| Update tool guidance | `packages/opencode/src/tool/task.txt`              | Explicitly mention metadata tags and required params |
| Verify truncation    | `packages/opencode/src/tool/tool.ts` + target tool | Metadata tags must survive truncation                |
| Prompt changes       | `packages/opencode/src/session/prompt/*`           | Minimal, scoped, no new behavior promises            |
| Tests                | `packages/opencode/test/*` + integration scripts   | Unit test + LLM-facing check                         |

## Example (Task resume)

```ts
const truncated = await Truncate.output(text, {}, caller)
const output = `${truncated.content}\n\n<task_metadata>\nsession_id: ${session.id}\n</task_metadata>`

return {
  output,
  metadata: {
    truncated: truncated.truncated,
    ...(truncated.truncated ? { outputPath: truncated.outputPath } : {}),
  },
}
```

## Common Mistakes

- Editing system prompts without checking tool output formatting or truncation.
- Relying on prompts to “return full output” when tools truncate by design.
- Skipping tests because it’s “just prompt text.”
- Changing multiple prompts at once, making regressions hard to isolate.

## Rationalizations to Block

| Excuse                                                    | Reality                                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| “Prompt-only change is enough, no need to inspect tools.” | Truncation and metadata live in code; prompt-only may be ineffective.                         |
| “Just tell the model to chunk output.”                    | Prompts cannot guarantee chunking without tool support.                                       |
| “I’ll run only prompt tests.”                             | You still need a unit test for formatting and an integration check if behavior is LLM-facing. |

## Red Flags

- “I’ll just tweak the system prompt.”
- “We can skip tests because it’s documentation.”
- “Let’s instruct the model to avoid truncation.”
