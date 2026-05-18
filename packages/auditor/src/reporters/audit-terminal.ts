import type { AuditReport, Finding, FindingCategory, Grade } from "@claws-shield/core"
import { RESET, gradeColor } from "@claws-shield/core"

const CATEGORY_LABELS: Record<FindingCategory, string> = {
	telemetry: "Telemetry",
	remote_control: "Remote Control",
	permissions: "Permissions",
	network: "Network",
	undercover: "Undercover",
	privacy: "Privacy",
	hidden_features: "Hidden Features",
}

const SEVERITY_COLORS: Record<string, string> = {
	critical: "\x1b[35m", // magenta
	high: "\x1b[31m", // red
	medium: "\x1b[33m", // yellow
	low: "\x1b[36m", // cyan
	info: "\x1b[37m", // white
}

const BOLD = "\x1b[1m"
const DIM = "\x1b[2m"

export function formatTerminal(report: AuditReport): string {
	const lines: string[] = []

	// Grade badge
	const gc = gradeColor(report.overallGrade)
	lines.push("")
	lines.push(`${BOLD}${gc}  ╔═══════════════════════════════╗${RESET}`)
	lines.push(
		`${BOLD}${gc}  ║  AUDIT GRADE:  ${report.overallGrade}  (${report.overallScore}/100)     ║${RESET}`,
	)
	lines.push(`${BOLD}${gc}  ╚═══════════════════════════════╝${RESET}`)
	lines.push("")

	// Tool info
	lines.push(`${BOLD}Tool:${RESET} ${report.tool}${report.version ? ` v${report.version}` : ""}`)
	lines.push(`${BOLD}Date:${RESET} ${report.auditDate}`)
	lines.push("")

	// Category summary table
	lines.push(`${BOLD}Category Breakdown:${RESET}`)
	lines.push(`${DIM}${"─".repeat(56)}${RESET}`)
	lines.push(`  ${"Category".padEnd(20)} ${"Grade".padEnd(8)} ${"Score".padEnd(10)} Issues`)
	lines.push(`${DIM}${"─".repeat(56)}${RESET}`)

	for (const [cat, label] of Object.entries(CATEGORY_LABELS) as [FindingCategory, string][]) {
		const cs = report.categories[cat]
		if (!cs) continue
		const catGc = gradeColor(cs.grade)
		lines.push(
			`  ${label.padEnd(20)} ${catGc}${cs.grade.padEnd(8)}${RESET} ${String(cs.score).padEnd(10)} ${cs.issueCount}`,
		)
	}
	lines.push(`${DIM}${"─".repeat(56)}${RESET}`)
	lines.push("")

	// Top findings (critical and high only for terminal)
	const topFindings = report.findings.filter(
		(f) => f.severity === "critical" || f.severity === "high",
	)
	if (topFindings.length > 0) {
		lines.push(`${BOLD}Top Findings:${RESET}`)
		lines.push("")
		for (const finding of topFindings.slice(0, 10)) {
			const sc = SEVERITY_COLORS[finding.severity]
			lines.push(`  ${sc}[${finding.severity.toUpperCase()}]${RESET} ${finding.title}`)
			lines.push(
				`  ${DIM}${finding.description.slice(0, 120)}${finding.description.length > 120 ? "..." : ""}${RESET}`,
			)
			lines.push("")
		}
	}

	// Medium findings count
	const mediumCount = report.findings.filter((f) => f.severity === "medium").length
	const lowCount = report.findings.filter((f) => f.severity === "low").length
	const infoCount = report.findings.filter((f) => f.severity === "info").length
	if (mediumCount + lowCount + infoCount > 0) {
		lines.push(
			`${DIM}  + ${mediumCount} medium, ${lowCount} low, ${infoCount} info finding(s)${RESET}`,
		)
		lines.push("")
	}

	// Recommendations
	if (report.recommendations.length > 0) {
		lines.push(`${BOLD}Recommendations:${RESET}`)
		for (const rec of report.recommendations.slice(0, 5)) {
			lines.push(`  - ${rec}`)
		}
		if (report.recommendations.length > 5) {
			lines.push(`${DIM}  ... and ${report.recommendations.length - 5} more${RESET}`)
		}
		lines.push("")
	}

	// Footer
	lines.push(
		`${DIM}Engine v${report.metadata.engineVersion} | KB v${report.metadata.kbVersion} | ${report.metadata.analyzersRun.length} analyzers | ${report.metadata.duration}ms${RESET}`,
	)
	lines.push("")

	return lines.join("\n")
}
