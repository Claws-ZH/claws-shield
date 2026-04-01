import type { ScanFinding } from "@claws-shield/core"

const SEVERITY_PENALTY: Record<string, { per: number; max: number }> = {
  critical: { per: 30, max: 60 },
  high: { per: 15, max: 45 },
  medium: { per: 7, max: 28 },
  low: { per: 3, max: 15 },
  info: { per: 0, max: 0 },
}

export function computeScanScore(findings: ScanFinding[]): {
  score: number
  safeToInstall: boolean
  manualReviewRequired: boolean
} {
  let penalty = 0

  const bySeverity: Record<string, number> = {}
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1
  }

  for (const [sev, count] of Object.entries(bySeverity)) {
    const config = SEVERITY_PENALTY[sev]
    if (config) {
      penalty += Math.min(count * config.per, config.max)
    }
  }

  const score = Math.max(0, 100 - penalty)
  const hasCritical = (bySeverity["critical"] ?? 0) > 0
  const highCount = bySeverity["high"] ?? 0

  return {
    score,
    safeToInstall: !hasCritical && highCount < 2,
    manualReviewRequired: hasCritical || highCount >= 1 || findings.length >= 5,
  }
}
