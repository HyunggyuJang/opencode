/**
 * Patch Update Notice
 *
 * Detects newer upstream v* tags and offers to create a new patch/<tag>
 * branch by rebasing the latest patch branch, then runs bun run self-build
 * and pushes the branch to origin.
 */

import fs from "node:fs"
import path from "node:path"

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent"

type Version = {
  major: number
  minor: number
  patch: number
}

const parseVersion = (value: string) => {
  const match = value.match(/v?(\d+)\.(\d+)\.(\d+)/)
  if (!match) return
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  }
}

const compareVersions = (left: Version, right: Version) => {
  if (left.major !== right.major) return Math.sign(left.major - right.major)
  if (left.minor !== right.minor) return Math.sign(left.minor - right.minor)
  if (left.patch !== right.patch) return Math.sign(left.patch - right.patch)
  return 0
}

const firstLine = (text: string, transform?: (line: string) => string) => {
  for (const rawLine of text.split("\n")) {
    const trimmed = rawLine.trim()
    if (!trimmed) continue
    const value = transform ? transform(rawLine) : trimmed
    const normalized = value.trim()
    if (normalized) return normalized
  }
}

const remoteTags = (text: string) => {
  const tags = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const parts = line.split("\t")
      const ref = parts[1]?.trim()
      if (!ref) return []
      if (!ref.startsWith("refs/tags/")) return []
      const tag = ref.replace("refs/tags/", "").replace(/\^\{\}$/, "")
      if (!tag) return []
      return [tag]
    })

  return Array.from(new Set(tags))
}

const pickLatestTag = (tags: string[]) => {
  const entries = tags.flatMap((tag) => {
    const version = parseVersion(tag)
    if (!version) return []
    return [{ tag, version }]
  })

  const sorted = entries.sort((left, right) => compareVersions(right.version, left.version))
  return sorted[0]?.tag
}

const getRepoRoot = async (pi: ExtensionAPI, cwd: string) => {
  const result = await pi.exec("git", ["rev-parse", "--show-toplevel"], { cwd })
  if (result.code !== 0) return
  return firstLine(result.stdout)
}

const getGitDir = async (pi: ExtensionAPI, cwd: string) => {
  const result = await pi.exec("git", ["rev-parse", "--git-dir"], { cwd })
  if (result.code !== 0) return
  const gitDir = firstLine(result.stdout)
  if (!gitDir) return
  return path.isAbsolute(gitDir) ? gitDir : path.join(cwd, gitDir)
}

const isRebaseInProgress = async (pi: ExtensionAPI, cwd: string) => {
  const gitDir = await getGitDir(pi, cwd)
  if (!gitDir) return false
  return (
    fs.existsSync(path.join(gitDir, "rebase-merge")) ||
    fs.existsSync(path.join(gitDir, "rebase-apply"))
  )
}

const listRemotes = async (pi: ExtensionAPI, cwd: string) => {
  const result = await pi.exec("git", ["remote"], { cwd })
  if (result.code !== 0) return

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

const getPreferredRemote = async (pi: ExtensionAPI, cwd: string) => {
  const remotes = await listRemotes(pi, cwd)
  if (!remotes || remotes.length === 0) return
  if (remotes.includes("upstream")) return "upstream"
  return remotes[0]
}

const hasRemote = async (pi: ExtensionAPI, cwd: string, name: string) => {
  const remotes = await listRemotes(pi, cwd)
  if (!remotes) return false
  return remotes.includes(name)
}

const fetchTags = async (pi: ExtensionAPI, cwd: string, remote: string) => {
  const result = await pi.exec("git", ["fetch", remote, "--tags"], { cwd })
  return result.code === 0 && !result.killed
}

const getLatestRemoteTag = async (pi: ExtensionAPI, cwd: string, remote: string) => {
  const result = await pi.exec("git", ["ls-remote", "--tags", remote, "refs/tags/v*"], { cwd })
  if (result.code !== 0 || result.killed) return
  const tag = pickLatestTag(remoteTags(result.stdout))
  return tag
}

const getLatestPatchBranch = async (pi: ExtensionAPI, cwd: string) => {
  const result = await pi.exec("git", ["branch", "--list", "patch/v*", "--sort=-v:refname"], { cwd })
  if (result.code !== 0) return
  return firstLine(result.stdout, (line) => line.replace(/^\*?\s*/, ""))
}

const isWorkingTreeClean = async (pi: ExtensionAPI, cwd: string) => {
  const result = await pi.exec("git", ["status", "--porcelain"], { cwd })
  if (result.code !== 0) return false
  return result.stdout.trim().length === 0
}

const branchExists = async (pi: ExtensionAPI, cwd: string, branchName: string) => {
  const result = await pi.exec("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`], { cwd })
  return result.code === 0 && !result.killed
}

const formatCommand = (command: string, args: string[]) => `${command} ${args.join(" ")}`.trim()

const formatCommandError = (
  command: string,
  args: string[],
  stderr: string,
  stdout: string,
  code: number,
) => {
  const output = stderr.trim() || stdout.trim()
  const cmd = formatCommand(command, args)
  return output ? `${cmd} failed: ${output}` : `${cmd} failed with exit code ${code}`
}

const runCheckedCommand = async (
  pi: ExtensionAPI,
  cwd: string,
  command: string,
  args: string[],
) => {
  const result = await pi.exec(command, args, { cwd })
  if (result.code !== 0 || result.killed) {
    throw new Error(formatCommandError(command, args, result.stderr, result.stdout, result.code))
  }
}

const buildFailureMessage = (message: string, rebaseInProgress: boolean) => {
  const lines = ["Patch update failed.", `Error: ${message}`]
  if (rebaseInProgress) {
    lines.push("Rebase is in progress. Resolve conflicts and run `git rebase --continue` or `git rebase --abort`.")
  }
  return lines.join("\n")
}

const promptRebaseResolution = async (pi: ExtensionAPI, ctx: ExtensionContext, cwd: string) => {
  const choice = await ctx.ui.select("Rebase in progress", ["Abort rebase", "Continue rebase", "Do nothing"])
  if (!choice || choice === "Do nothing") return

  const args = choice === "Abort rebase" ? ["rebase", "--abort"] : ["rebase", "--continue"]
  const actionLabel = choice === "Abort rebase" ? "abort" : "continue"
  ctx.ui.setStatus("patch-update", `${choice}...`)

  try {
    await runCheckedCommand(pi, cwd, "git", args)
    ctx.ui.notify(`Rebase ${actionLabel} completed.`, "info")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ctx.ui.notify(`Rebase ${actionLabel} failed: ${message}`, "error")
  } finally {
    ctx.ui.setStatus("patch-update", undefined)
  }
}

const run = async (pi: ExtensionAPI, ctx: ExtensionContext) => {
  const repoRoot = await getRepoRoot(pi, ctx.cwd)
  if (!repoRoot) return

  const remote = await getPreferredRemote(pi, repoRoot)
  if (!remote) return

  const latestTag = await getLatestRemoteTag(pi, repoRoot, remote)
  if (!latestTag) return

  const fetched = await fetchTags(pi, repoRoot, remote)
  if (!fetched) {
    ctx.ui.notify(`Failed to fetch tags from ${remote}`, "error")
    return
  }

  const latestPatch = await getLatestPatchBranch(pi, repoRoot)
  if (!latestPatch) return

  const tagVersion = parseVersion(latestTag)
  const patchVersion = parseVersion(latestPatch.replace(/^patch\//, ""))
  if (!tagVersion || !patchVersion) return

  if (compareVersions(tagVersion, patchVersion) <= 0) return

  const workingTreeClean = await isWorkingTreeClean(pi, repoRoot)
  if (!workingTreeClean) {
    ctx.ui.notify("Working tree is dirty; skipping patch update prompt.", "warning")
    return
  }

  const nextBranch = `patch/${latestTag}`
  if (await branchExists(pi, repoRoot, nextBranch)) {
    ctx.ui.notify(`${nextBranch} already exists.`, "info")
    return
  }

  const confirm = await ctx.ui.confirm(
    "Create patch branch?",
    [
      `New upstream tag: ${latestTag}`,
      `Latest patch branch: ${latestPatch}`,
      `This will create ${nextBranch}, rebase ${latestPatch} onto ${latestTag}, run bun run self-build, and push to origin.`,
    ].join("\n"),
  )
  if (!confirm) return

  ctx.ui.setStatus("patch-update", "Creating patch branch...")
  try {
    await runCheckedCommand(pi, repoRoot, "git", ["fetch", remote, "--tags"])
    await runCheckedCommand(pi, repoRoot, "git", ["switch", latestPatch])
    await runCheckedCommand(pi, repoRoot, "git", ["switch", "-c", nextBranch])
    await runCheckedCommand(pi, repoRoot, "git", ["-c", "rerere.enabled=true", "rebase", "--rebase-merges", latestTag])
    await runCheckedCommand(pi, repoRoot, "bun", ["run", "self-build"])

    const origin = await hasRemote(pi, repoRoot, "origin")
    if (!origin) {
      ctx.ui.notify("origin remote not found; skipping push.", "warning")
      ctx.ui.notify(`Created ${nextBranch} and completed self-build.`, "info")
      return
    }

    await runCheckedCommand(pi, repoRoot, "git", ["push", "origin", nextBranch])

    ctx.ui.notify(`Created ${nextBranch}, completed self-build, and pushed to origin.`, "info")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const rebaseInProgress = await isRebaseInProgress(pi, repoRoot)
    const failureMessage = buildFailureMessage(message, rebaseInProgress)

    ctx.ui.notify(`Patch update failed: ${message}`, "error")
    pi.sendMessage(
      {
        customType: "patch-update",
        content: failureMessage,
        display: true,
        details: { error: message, rebaseInProgress },
      },
      { deliverAs: "nextTurn" },
    )

    if (rebaseInProgress) {
      await promptRebaseResolution(pi, ctx, repoRoot)
    }
  } finally {
    ctx.ui.setStatus("patch-update", undefined)
  }
}

const defer = (pi: ExtensionAPI, ctx: ExtensionContext) => {
  setTimeout(() => {
    void run(pi, ctx).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      ctx.ui.notify(`Patch update check failed: ${message}`, "error")
    })
  }, 0)
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return

    defer(pi, ctx)
  })
}
