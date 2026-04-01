import { readFileSync, existsSync } from "node:fs"
import { join, resolve } from "node:path"

export interface KBManifest {
  schemaVersion: string
  generatedAt: string
  sources: string[]
  datasets: Record<string, string>
}

export function findKBRoot(startDir?: string): string {
  const candidates = [
    startDir,
    join(process.cwd(), "knowledge-base"),
    join(process.cwd(), "..", "knowledge-base"),
    resolve(__dirname, "..", "..", "..", "knowledge-base"),
  ].filter(Boolean) as string[]

  for (const dir of candidates) {
    if (existsSync(join(dir, "manifest.json"))) return dir
  }
  throw new Error("Knowledge base not found. Searched: " + candidates.join(", "))
}

export function loadKBFile<T>(kbRoot: string, relativePath: string): T {
  const fullPath = join(kbRoot, relativePath)
  if (!existsSync(fullPath)) {
    throw new Error(`KB file not found: ${fullPath}`)
  }
  const raw = readFileSync(fullPath, "utf-8")
  return JSON.parse(raw) as T
}

export function loadManifest(kbRoot: string): KBManifest {
  return loadKBFile<KBManifest>(kbRoot, "manifest.json")
}
