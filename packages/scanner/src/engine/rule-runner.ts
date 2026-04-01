import type { ScanRule, ScanContext, ScanFinding } from "@claws-shield/core"
import { minimatch } from "minimatch"

export async function runRules(rules: ScanRule[], context: ScanContext): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = []

  for (const rule of rules) {
    const applicableFiles = [...context.files.keys()].filter((f) =>
      rule.appliesTo.some((pattern) => minimatch(f, pattern))
    )

    if (applicableFiles.length === 0 && !rule.appliesTo.includes("*")) continue

    try {
      const ruleFindings = await rule.run(context)
      findings.push(...ruleFindings)
    } catch {
      // Rule failed silently — don't let one rule crash the whole scan
    }
  }

  return findings
}
