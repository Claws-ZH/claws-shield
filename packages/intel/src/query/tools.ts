import type { IntelDatabase } from "../loader/load-kb.js"

export function queryTools(db: IntelDatabase, opts?: { name?: string; status?: string; capabilityArea?: string; featureFlag?: string }) {
  let results = db.unreleasedTools
  if (opts?.name) {
    const q = opts.name.toLowerCase()
    results = results.filter((t: any) => t.name.toLowerCase().includes(q))
  }
  if (opts?.status) {
    results = results.filter((t: any) => t.status === opts.status)
  }
  if (opts?.capabilityArea) {
    results = results.filter((t: any) => t.capabilityArea === opts.capabilityArea)
  }
  if (opts?.featureFlag) {
    results = results.filter((t: any) => t.featureFlags.includes(opts.featureFlag))
  }
  return results
}
