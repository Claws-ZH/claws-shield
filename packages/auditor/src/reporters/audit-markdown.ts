import type { AuditReport, Finding, CategoryScore, FindingCategory, Grade } from "@claws-shield/core"

const CATEGORY_LABELS: Record<FindingCategory, string> = {
  telemetry: "Telemetry & Data Collection",
  remote_control: "Remote Control & Kill Switches",
  permissions: "Permissions & Access",
  network: "Network Connections",
  undercover: "Undercover & Attribution",
  privacy: "Privacy",
  hidden_features: "Hidden Features",
}

const SEVERITY_ICONS: Record<string, string> = {
  critical: "[!!!]",
  high: "[!!]",
  medium: "[!]",
  low: "[~]",
  info: "[i]",
}

export function formatMarkdown(report: AuditReport): string {
  const lines: string[] = []

  // Header
  lines.push(`# Audit Report: ${report.tool}`)
  if (report.version) lines.push(`**Version:** ${report.version}`)
  lines.push(`**Date:** ${report.auditDate}`)
  lines.push(`**Overall Grade:** ${report.overallGrade} (${report.overallScore}/100)`)
  lines.push("")

  // Summary
  lines.push("## Summary")
  lines.push("")
  lines.push(`- **Total findings:** ${report.findings.length}`)
  const bySeverity = groupBy(report.findings, (f) => f.severity)
  for (const sev of ["critical", "high", "medium", "low", "info"] as const) {
    const count = bySeverity[sev]?.length ?? 0
    if (count > 0) {
      lines.push(`- **${sev}:** ${count}`)
    }
  }
  lines.push("")

  // Category Breakdown
  lines.push("## Category Breakdown")
  lines.push("")
  lines.push("| Category | Grade | Score | Issues |")
  lines.push("|----------|-------|-------|--------|")
  for (const [cat, label] of Object.entries(CATEGORY_LABELS) as [FindingCategory, string][]) {
    const cs = report.categories[cat]
    if (cs) {
      lines.push(`| ${label} | ${cs.grade} | ${cs.score}/100 | ${cs.issueCount} |`)
    }
  }
  lines.push("")

  // Findings by Severity
  lines.push("## Findings")
  lines.push("")
  for (const sev of ["critical", "high", "medium", "low", "info"] as const) {
    const findings = bySeverity[sev]
    if (!findings || findings.length === 0) continue

    lines.push(`### ${sev.charAt(0).toUpperCase() + sev.slice(1)} ${SEVERITY_ICONS[sev]}`)
    lines.push("")
    for (const finding of findings) {
      lines.push(`#### ${finding.title}`)
      lines.push("")
      lines.push(`**Category:** ${CATEGORY_LABELS[finding.category]}`)
      lines.push("")
      lines.push(finding.description)
      lines.push("")
      if (finding.recommendation) {
        lines.push(`> **Recommendation:** ${finding.recommendation}`)
        lines.push("")
      }
      if (finding.references && finding.references.length > 0) {
        lines.push(`**References:** ${finding.references.join(", ")}`)
        lines.push("")
      }
    }
  }

  // Evidence Summary
  if (report.evidence.length > 0) {
    lines.push("## Evidence")
    lines.push("")
    lines.push(`Total evidence items: ${report.evidence.length}`)
    lines.push("")
    const byType = groupBy(report.evidence, (e) => e.type)
    for (const [type, items] of Object.entries(byType)) {
      lines.push(`- **${type}:** ${items.length} item(s)`)
    }
    lines.push("")
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push("## Recommendations")
    lines.push("")
    for (const rec of report.recommendations) {
      lines.push(`- ${rec}`)
    }
    lines.push("")
  }

  // Metadata
  lines.push("---")
  lines.push("")
  lines.push(`*Engine: v${report.metadata.engineVersion} | KB: v${report.metadata.kbVersion} | Analyzers: ${report.metadata.analyzersRun.join(", ")} | Duration: ${report.metadata.duration}ms*`)
  lines.push("")

  return lines.join("\n")
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {}
  for (const item of items) {
    const k = key(item)
    if (!result[k]) result[k] = []
    result[k].push(item)
  }
  return result
}
