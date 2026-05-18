import type { AuditReport, FindingCategory, ReportFormat } from "@claws-shield/core"
import { ENGINE_VERSION, KB_SCHEMA_VERSION, findKBRoot } from "@claws-shield/core"
import { computeAuditScore } from "../scoring/audit-score.js"
import type { Analyzer, AuditOptions, TargetInfo } from "../types/index.js"
import { AuditContext } from "./audit-context.js"
import { loadTarget } from "./target-loader.js"

import { HiddenToolsAnalyzer } from "../analyzers/hidden-tools.js"
import { NetworkAnalyzer } from "../analyzers/network.js"
import { PermissionsAnalyzer } from "../analyzers/permissions.js"
import { PrivacyAnalyzer } from "../analyzers/privacy.js"
import { RemoteControlAnalyzer } from "../analyzers/remote-control.js"
// Analyzers
import { TelemetryAnalyzer } from "../analyzers/telemetry.js"
import { UndercoverAnalyzer } from "../analyzers/undercover.js"

// All analyzers in execution order (privacy runs last)
const ALL_ANALYZERS: Analyzer[] = [
	new TelemetryAnalyzer(),
	new RemoteControlAnalyzer(),
	new UndercoverAnalyzer(),
	new PermissionsAnalyzer(),
	new NetworkAnalyzer(),
	new HiddenToolsAnalyzer(),
	new PrivacyAnalyzer(), // Must be last — depends on other findings
]

export async function runAudit(targetPath: string, options?: AuditOptions): Promise<AuditReport> {
	const startTime = Date.now()

	// Load target
	const target = loadTarget(targetPath)

	// Init context
	const kbRoot = options?.kbRoot ?? tryFindKBRoot()
	const ctx = new AuditContext(targetPath, kbRoot)

	// Select analyzers
	let analyzers = ALL_ANALYZERS
	if (options?.analyzers && options.analyzers.length > 0) {
		const selected = new Set(options.analyzers.map((a) => a.toLowerCase()))
		analyzers = ALL_ANALYZERS.filter((a) => selected.has(a.name.toLowerCase()))
		// Always include privacy if other analyzers are selected
		if (!selected.has("privacy") && analyzers.length > 0) {
			analyzers.push(new PrivacyAnalyzer())
		}
	}

	// Run analyzers sequentially (privacy must run last)
	for (const analyzer of analyzers) {
		await analyzer.analyze(ctx, target)
	}

	// Compute scores
	const scoreResult = computeAuditScore(ctx)

	// Build recommendations from findings
	const recommendations = buildRecommendations(ctx)

	const duration = Date.now() - startTime

	const report: AuditReport = {
		tool: target.toolName ?? "unknown",
		version: target.toolVersion,
		auditDate: new Date().toISOString(),
		overallGrade: scoreResult.overall.grade,
		overallScore: scoreResult.overall.score,
		categories: scoreResult.categories,
		findings: ctx.findings,
		evidence: ctx.evidence,
		recommendations,
		metadata: {
			engineVersion: ENGINE_VERSION,
			kbVersion: KB_SCHEMA_VERSION,
			analyzersRun: analyzers.map((a) => a.name),
			duration,
		},
	}

	return report
}

function tryFindKBRoot(): string {
	try {
		return findKBRoot()
	} catch {
		// Return a dummy path; analyzers handle missing KB gracefully
		return ""
	}
}

function buildRecommendations(ctx: AuditContext): string[] {
	const recs = new Set<string>()
	for (const finding of ctx.findings) {
		if (finding.recommendation) {
			recs.add(finding.recommendation)
		}
	}
	// Sort by severity priority: recommendations from critical findings first
	const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
	const sortedFindings = [...ctx.findings]
		.filter((f) => f.recommendation)
		.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

	const ordered: string[] = []
	const seen = new Set<string>()
	for (const finding of sortedFindings) {
		if (finding.recommendation && !seen.has(finding.recommendation)) {
			seen.add(finding.recommendation)
			ordered.push(finding.recommendation)
		}
	}
	return ordered
}
