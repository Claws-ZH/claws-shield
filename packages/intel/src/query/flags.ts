import type { IntelDatabase } from "../loader/load-kb.js"

export interface FlagQueryOptions {
  name?: string
  prefix?: string
  category?: string
  productArea?: string
  riskLevel?: string
  availability?: string
}

export function queryFlags(db: IntelDatabase, opts: FlagQueryOptions) {
  let results = db.featureFlags
  if (opts.name) {
    const q = opts.name.toLowerCase()
    results = results.filter((f: any) => f.flag.toLowerCase().includes(q) || f.decodedPurpose.toLowerCase().includes(q))
  }
  if (opts.prefix) {
    results = results.filter((f: any) => f.flag.startsWith(opts.prefix!))
  }
  if (opts.category) {
    results = results.filter((f: any) => f.category === opts.category)
  }
  if (opts.productArea) {
    results = results.filter((f: any) => f.productArea === opts.productArea)
  }
  if (opts.riskLevel) {
    results = results.filter((f: any) => f.riskLevel === opts.riskLevel)
  }
  if (opts.availability) {
    results = results.filter((f: any) => f.availability === opts.availability)
  }
  return results
}

export function queryKillswitches(db: IntelDatabase, opts?: { remoteControlled?: boolean; riskLevel?: string }) {
  let results = db.killswitches
  if (opts?.remoteControlled !== undefined) {
    results = results.filter((k: any) => k.remoteControlled === opts.remoteControlled)
  }
  if (opts?.riskLevel) {
    results = results.filter((k: any) => k.riskLevel === opts.riskLevel)
  }
  return results
}
