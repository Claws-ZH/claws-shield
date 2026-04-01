import type { ScanRule, ScanFinding, ScanContext } from "@claws-shield/core"
import { scoreToGrade } from "@claws-shield/core"
import { collectFiles } from "./file-collector.js"
import { runRules } from "./rule-runner.js"
import { computeScanScore } from "../scoring/score-scan.js"
import { getAllRules } from "../rules/index.js"

export interface ScanResult {
  skill: string
  scanDate: string
  securityGrade: string
  securityScore: number
  findings: ScanFinding[]
  safeToInstall: boolean
  manualReviewRequired: boolean
  metadata: {
    rulesRun: number
    filesScanned: number
    durationMs: number
  }
}

export async function scanSkill(skillPath: string, customRules?: ScanRule[]): Promise<ScanResult> {
  const start = Date.now()
  const context = collectFiles(skillPath)
  const rules = customRules ?? getAllRules()
  const findings = await runRules(rules, context)
  const { score, safeToInstall, manualReviewRequired } = computeScanScore(findings)

  return {
    skill: skillPath,
    scanDate: new Date().toISOString(),
    securityGrade: scoreToGrade(score),
    securityScore: score,
    findings,
    safeToInstall,
    manualReviewRequired,
    metadata: {
      rulesRun: rules.length,
      filesScanned: context.files.size,
      durationMs: Date.now() - start,
    },
  }
}
