import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join, relative, extname } from "node:path"
import type { ScanContext } from "@claws-shield/core"

export function collectFiles(skillPath: string): ScanContext {
  const files = new Map<string, string>()
  const textExtensions = new Set([".md", ".txt", ".js", ".mjs", ".ts", ".json", ".yaml", ".yml", ".sh", ".bash", ".py", ".toml"])

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".git") continue
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        walk(full)
      } else if (stat.isFile() && stat.size < 1_000_000) {
        const ext = extname(entry).toLowerCase()
        if (textExtensions.has(ext) || entry === "SKILL.md" || entry === "skill.md") {
          const rel = relative(skillPath, full)
          try {
            files.set(rel, readFileSync(full, "utf-8"))
          } catch {}
        }
      }
    }
  }

  walk(skillPath)

  const ctx: ScanContext = { skillPath, files }

  // Parse SKILL.md
  const skillMdContent = files.get("SKILL.md") ?? files.get("skill.md")
  if (skillMdContent) {
    ctx.skillMd = parseSkillMd(skillMdContent)
  }

  // Parse package.json
  const pkgContent = files.get("package.json")
  if (pkgContent) {
    try { ctx.packageJson = JSON.parse(pkgContent) } catch {}
  }

  return ctx
}

function parseSkillMd(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: content }

  const frontmatter: Record<string, unknown> = {}
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":")
    if (idx > 0) {
      const key = line.slice(0, idx).trim()
      const val = line.slice(idx + 1).trim()
      frontmatter[key] = val
    }
  }
  return { frontmatter, body: match[2] }
}
