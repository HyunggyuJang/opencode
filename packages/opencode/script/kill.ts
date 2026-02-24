#!/usr/bin/env bun
/**
 * Kill all processes launched by opencode (PTY sessions, LSP servers,
 * MCP local servers, ripgrep, etc.) plus the opencode processes themselves.
 *
 * Usage:
 *   bun run script/kill.ts [--dry-run]
 */

const dry = Bun.argv.includes("--dry-run")

// Build a pid→children map from `ps`
async function childMap(): Promise<Map<number, number[]>> {
  const result = await Bun.spawn(["ps", "-eo", "pid,ppid"], {
    stdout: "pipe",
    stderr: "ignore",
  })
  const text = await Bun.readableStreamToText(result.stdout)
  const map = new Map<number, number[]>()
  for (const line of text.split("\n").slice(1)) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 2) continue
    const pid = parseInt(parts[0])
    const ppid = parseInt(parts[1])
    if (isNaN(pid) || isNaN(ppid)) continue
    const siblings = map.get(ppid) ?? []
    siblings.push(pid)
    map.set(ppid, siblings)
  }
  return map
}

// Collect pid and all its descendants (depth-first, leaves first for kill order)
function descendants(pid: number, map: Map<number, number[]>): number[] {
  const children = map.get(pid) ?? []
  return [...children.flatMap((c) => descendants(c, map)), pid]
}

// Find pids of processes whose argv[0] contains "opencode"
async function opencodeRoots(): Promise<number[]> {
  const result = await Bun.spawn(["pgrep", "-f", "opencode"], {
    stdout: "pipe",
    stderr: "ignore",
  })
  const text = await Bun.readableStreamToText(result.stdout)
  return text
    .split("\n")
    .map((l) => parseInt(l.trim()))
    .filter((n) => !isNaN(n) && n !== process.pid && n !== process.ppid)
}

async function run() {
  const [roots, map] = await Promise.all([opencodeRoots(), childMap()])

  if (roots.length === 0) {
    console.log("No opencode processes found.")
    return
  }

  // Deduplicate: collect all pids to kill in leaves-first order
  const seen = new Set<number>()
  const pids: number[] = []
  for (const root of roots) {
    for (const pid of descendants(root, map)) {
      if (!seen.has(pid)) {
        seen.add(pid)
        pids.push(pid)
      }
    }
  }

  console.log(`Found ${pids.length} process(es) to kill: ${pids.join(" ")}`)

  if (dry) {
    console.log("Dry run — no signals sent.")
    return
  }

  // SIGTERM pass
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM")
    } catch {
      // already gone
    }
  }

  await Bun.sleep(300)

  // SIGKILL pass for survivors
  for (const pid of pids) {
    try {
      process.kill(pid, 0) // probe: throws if gone
      process.kill(pid, "SIGKILL")
      console.log(`  SIGKILL → ${pid}`)
    } catch {
      // already gone
    }
  }

  console.log("Done.")
}

await run()
