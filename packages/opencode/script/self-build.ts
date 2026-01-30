import { $ } from "bun"
import { mkdir, symlink } from "node:fs/promises"
import os from "node:os"
import path from "path"

const versionFromTags = (input: string) => {
  const value = input
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.length > 0)

  if (!value) return ""

  return value.startsWith("v") ? value.slice(1) : value
}

const buildArgs = (args: string[]) => ["run", "script/build.ts", "--single", ...args]

const gitArgs = () => ["describe", "--tags", "--match", "v*", "--abbrev=0"]

const resolveVersion = (env: NodeJS.ProcessEnv, tags: string) => {
  if (env.OPENCODE_VERSION) return env.OPENCODE_VERSION

  const value = versionFromTags(tags)
  if (!value) throw new Error("No git tags found")

  return value
}

const channelFromEnv = (env: NodeJS.ProcessEnv) => env.OPENCODE_CHANNEL ?? "latest"

const autoupdateFromEnv = (env: NodeJS.ProcessEnv) => env.OPENCODE_DISABLE_AUTOUPDATE ?? "1"

const platformName = (platform: string) => (platform === "win32" ? "windows" : platform)

const binaryName = (platform: string) => (platform === "win32" ? "opencode.exe" : "opencode")

const binaryPath = (root: string, platform: string, arch: string) =>
  path.join(root, "dist", `opencode-${platformName(platform)}-${arch}`, "bin", binaryName(platform))

const linkPath = (home: string, name: string) => path.join(home, ".local", "bin", name)

const linkSpec = (root: string, home: string, platform: string, arch: string) => {
  const source = binaryPath(root, platform, arch)
  const dest = linkPath(home, binaryName(platform))

  return {
    source,
    dest,
    dir: path.dirname(dest),
  }
}

if (import.meta.main) {
  const run = async () => {
    const cmd = await $`git ${gitArgs()}`.nothrow()
    const tags = cmd.stdout.toString()
    const version = resolveVersion(process.env, tags)
    const channel = channelFromEnv(process.env)
    const autoupdate = autoupdateFromEnv(process.env)
    const args = buildArgs(Bun.argv.slice(2))

    await $`bun ${args}`.env({
      ...process.env,
      OPENCODE_VERSION: version,
      OPENCODE_CHANNEL: channel,
      OPENCODE_DISABLE_AUTOUPDATE: autoupdate,
    })

    if (process.platform === "win32") return

    const spec = linkSpec(process.cwd(), os.homedir(), process.platform, process.arch)
    const exists = await Bun.file(spec.source).exists()
    if (!exists) {
      console.warn(`self-build: binary missing at ${spec.source}, skipping auto-link`)
      return
    }

    const ready = await mkdir(spec.dir, { recursive: true })
      .then(() => true)
      .catch((error) => {
        console.warn(`self-build: failed to create ${spec.dir}, skipping auto-link`, error)
        return false
      })

    if (!ready) return

    await symlink(spec.source, spec.dest).catch((error) => {
      console.warn(`self-build: failed to link ${spec.dest}, skipping auto-link`, error)
    })
  }

  await run()
}

export {
  autoupdateFromEnv,
  binaryName,
  binaryPath,
  buildArgs,
  channelFromEnv,
  gitArgs,
  linkPath,
  linkSpec,
  platformName,
  resolveVersion,
  versionFromTags,
}
