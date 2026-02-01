import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"

const lines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

const strip = (value: string) => value.replace(/^\*\s*/, "").trim()

export default function (pi: ExtensionAPI) {
  pi.registerCommand("rebase-patch-stack", {
    description:
      "Rebase the latest patch/v* branch onto the newest v* tag (rerere + rebase-merges).",
    handler: async (_args, ctx) => {
      const note = (text: string, level: "info" | "warning" | "error") => {
        if (!ctx.hasUI) {
          console.log(text)
          return
        }
        ctx.ui.notify(text, level)
      }

      const run = async (label: string, args: string[]) => {
        const result = await pi.exec("git", args)
        if (result.code === 0) return result
        const output = [result.stdout, result.stderr]
          .filter(Boolean)
          .join("\n")
          .trim()
        const text = output.length > 0 ? `${label}\n${output}` : label
        note(text, "error")
      }

      const remotes = await run("Failed to list git remotes.", ["remote"])
      if (!remotes) return

      const names = lines(remotes.stdout)
      const remote = names.includes("upstream") ? "upstream" : names[0]
      if (!remote) {
        note("No git remotes found.", "error")
        return
      }

      const fetched = await run(`Failed to fetch tags from ${remote}.`, [
        "fetch",
        remote,
        "--tags",
      ])
      if (!fetched) return

      const tags = await run("Failed to list upstream tags.", [
        "tag",
        "--list",
        "v*",
        "--sort=-v:refname",
      ])
      if (!tags) return

      const tag = lines(tags.stdout)[0]
      if (!tag) {
        note("No upstream tags found.", "error")
        return
      }

      const branches = await run("Failed to list patch branches.", [
        "branch",
        "--list",
        "patch/v*",
        "--sort=-v:refname",
      ])
      if (!branches) return

      const patch = branches.stdout
        .split("\n")
        .map(strip)
        .filter(Boolean)[0]
      if (!patch) {
        note("No patch/v* branches found.", "error")
        return
      }

      const next = `patch/${tag}`
      const existing = await run(`Failed to check branch ${next}.`, [
        "branch",
        "--list",
        next,
      ])
      if (!existing) return

      const present = existing.stdout
        .split("\n")
        .map(strip)
        .filter(Boolean).length
      if (present > 0) {
        note(`Branch ${next} already exists.`, "error")
        return
      }

      const switched = await run(`Failed to switch to ${patch}.`, ["switch", patch])
      if (!switched) return

      const created = await run(`Failed to create ${next}.`, [
        "switch",
        "-c",
        next,
      ])
      if (!created) return

      const rebased = await pi.exec("git", [
        "-c",
        "rerere.enabled=true",
        "rebase",
        "--rebase-merges",
        tag,
      ])
      if (rebased.code !== 0) {
        const output = [rebased.stdout, rebased.stderr]
          .filter(Boolean)
          .join("\n")
          .trim()
        const text =
          output.length > 0 ? `Rebase failed for ${tag}.\n${output}` : `Rebase failed for ${tag}.`
        note(text, "error")
        if (
          output.includes("CONFLICT") ||
          output.includes("Resolve all conflicts") ||
          output.includes("fix conflicts")
        ) {
          note(`Patch needs resolution for ${tag}`, "warning")
        }
        return
      }

      note(`Rebased ${next} onto ${tag}.`, "info")
      note("Run `bun run self-build` to verify the patch stack.", "info")
    },
  })
}
