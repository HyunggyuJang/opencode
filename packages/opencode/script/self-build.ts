import { $ } from "bun"

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
  }

  await run()
}

export { autoupdateFromEnv, buildArgs, channelFromEnv, gitArgs, resolveVersion, versionFromTags }
