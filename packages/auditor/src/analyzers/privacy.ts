import { generateId, AUDIT_CATEGORY_WEIGHTS } from "@claws-shield/core"
import type { FindingCategory, Severity } from "@claws-shield/core"
import type { Analyzer, TargetInfo } from "../types/index.js"
import type { AuditContext } from "../engine/audit-context.js"
import { computeAuditScore } from "../scoring/audit-score.js"

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"]

const CATEGORY_LABELS: Record<FindingCategory, string> = {
  telemetry: "Telemetry & Data Collection",
  remote_control: "Remote Control & Kill Switches",
  permissions: "Permissions & Access",
  network: "Network Connections",
  undercover: "Undercover & Attribution",
  privacy: "Privacy",
  hidden_features: "Hidden Features",
}

export class PrivacyAnalyzer implements Analyzer {
  readonly name = "privacy"
  readonly category = "privacy" as const

  async analyze(ctx: AuditContext, target: TargetInfo): Promise<void> {
    // Privacy analyzer runs LAST and computes a composite view
    const scoreResult = computeAuditScore(ctx)

    // Count findings by severity across all categories
    const severityCounts: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    }
    for (const finding of ctx.findings) {
      severityCounts[finding.severity]++
    }

    // Identify worst categories (by score)
    const weightedCategories = (Object.entries(AUDIT_CATEGORY_WEIGHTS) as [FindingCategory, number][])
      .filter(([_, w]) => w > 0)
      .sort((a, b) => scoreResult.categories[a[0]].score - scoreResult.categories[b[0]].score)

    const worstCategories = weightedCategories
      .filter(([cat]) => scoreResult.categories[cat].score < 80)
      .slice(0, 3)

    // Generate privacy composite finding
    const totalFindings = ctx.findings.length
    const criticalAndHigh = severityCounts.critical + severityCounts.high

    if (totalFindings > 0) {
      let severity: Severity = "info"
      if (severityCounts.critical > 0) severity = "critical"
      else if (severityCounts.high > 1) severity = "high"
      else if (severityCounts.high > 0 || severityCounts.medium > 2) severity = "medium"
      else if (severityCounts.medium > 0) severity = "low"

      const description = buildPrivacySummary(
        totalFindings,
        severityCounts,
        worstCategories,
        scoreResult.overall.score,
        scoreResult.overall.grade,
      )

      ctx.addFinding({
        id: generateId("f"),
        category: "privacy",
        severity,
        title: "Composite privacy assessment",
        description,
        evidenceIds: [],
        recommendation: buildRecommendations(worstCategories, severityCounts),
      })
    }

    // Generate specific privacy-concern findings based on cross-category patterns
    const telemetryFindings = ctx.getFindingsByCategory("telemetry")
    const undercoverFindings = ctx.getFindingsByCategory("undercover")
    const networkFindings = ctx.getFindingsByCategory("network")

    // Telemetry + no opt-out + fingerprinting = major privacy concern
    if (
      telemetryFindings.some((f) => f.title.includes("Undeactivatable")) &&
      telemetryFindings.some((f) => f.title.includes("fingerprinting"))
    ) {
      ctx.addFinding({
        id: generateId("f"),
        category: "privacy",
        severity: "high",
        title: "Pervasive tracking without consent",
        description: "Combination of undeactivatable telemetry and device fingerprinting creates a persistent tracking mechanism that users cannot opt out of.",
        evidenceIds: [
          ...ctx.getEvidenceByType("endpoint").slice(0, 3),
          ...ctx.getEvidenceByType("env_fingerprint").slice(0, 3),
        ].map((e) => e.id),
        recommendation: "Implement genuine opt-out for all telemetry. Remove device fingerprinting or make it opt-in.",
      })
    }

    // Undercover + network exfil = deceptive data practices
    if (
      undercoverFindings.length > 0 &&
      networkFindings.some((f) => f.title.includes("exfiltration"))
    ) {
      ctx.addFinding({
        id: generateId("f"),
        category: "privacy",
        severity: "high",
        title: "Deceptive data practices",
        description: "Undercover capabilities combined with potential data exfiltration patterns suggest data may be collected while obscuring AI involvement.",
        evidenceIds: [
          ...ctx.getEvidenceByType("attribution_rule").slice(0, 2),
          ...ctx.getEvidenceByType("endpoint").slice(0, 2),
        ].map((e) => e.id),
        recommendation: "Ensure complete transparency about data collection. Separate AI attribution from data handling.",
      })
    }
  }
}

function buildPrivacySummary(
  totalFindings: number,
  severityCounts: Record<Severity, number>,
  worstCategories: [FindingCategory, number][],
  overallScore: number,
  overallGrade: string,
): string {
  const parts: string[] = []
  parts.push(`Overall privacy score: ${overallScore}/100 (Grade ${overallGrade}).`)
  parts.push(`Total findings: ${totalFindings} (${severityCounts.critical} critical, ${severityCounts.high} high, ${severityCounts.medium} medium, ${severityCounts.low} low, ${severityCounts.info} info).`)

  if (worstCategories.length > 0) {
    parts.push(`Areas of concern: ${worstCategories.map(([cat]) => CATEGORY_LABELS[cat]).join(", ")}.`)
  }

  return parts.join(" ")
}

function buildRecommendations(
  worstCategories: [FindingCategory, number][],
  severityCounts: Record<Severity, number>,
): string {
  const recs: string[] = []

  if (severityCounts.critical > 0) {
    recs.push("URGENT: Address all critical findings immediately.")
  }

  for (const [cat] of worstCategories) {
    switch (cat) {
      case "telemetry":
        recs.push("Implement comprehensive telemetry opt-out and minimize data collection.")
        break
      case "remote_control":
        recs.push("Remove forced update mechanisms. Make remote configuration transparent.")
        break
      case "permissions":
        recs.push("Apply principle of least privilege. Sandbox filesystem and shell access.")
        break
      case "network":
        recs.push("Audit all third-party connections. Prevent credential and environment variable leakage.")
        break
      case "undercover":
        recs.push("Maintain AI attribution transparency. Remove human impersonation instructions.")
        break
    }
  }

  if (recs.length === 0) {
    recs.push("Continue maintaining good privacy practices. Monitor for regressions.")
  }

  return recs.join(" ")
}
