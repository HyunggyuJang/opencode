const versionFromTags = (input: string) => {
  const value = input
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.length > 0)

  if (!value) return ""

  return value.startsWith("v") ? value.slice(1) : value
}

const buildArgs = (args: string[]) => ["run", "script/build.ts", "--single", ...args]

if (import.meta.main) {
}

export { buildArgs, versionFromTags }
