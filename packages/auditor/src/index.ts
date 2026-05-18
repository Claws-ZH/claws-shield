// @claws-shield/auditor - Flagship AI agent audit engine

// Engine
export { AuditContext } from "./engine/audit-context.js"
export { runAudit } from "./engine/audit-engine.js"
export { loadTarget } from "./engine/target-loader.js"

// Scoring
export { computeAuditScore } from "./scoring/audit-score.js"

// Analyzers
export { TelemetryAnalyzer } from "./analyzers/telemetry.js"
export { RemoteControlAnalyzer } from "./analyzers/remote-control.js"
export { UndercoverAnalyzer } from "./analyzers/undercover.js"
export { PermissionsAnalyzer } from "./analyzers/permissions.js"
export { NetworkAnalyzer } from "./analyzers/network.js"
export { HiddenToolsAnalyzer } from "./analyzers/hidden-tools.js"
export { PrivacyAnalyzer } from "./analyzers/privacy.js"

// Reporters
export { formatJson } from "./reporters/audit-json.js"
export { formatMarkdown } from "./reporters/audit-markdown.js"
export { formatTerminal } from "./reporters/audit-terminal.js"

// Types
export type { TargetInfo, AuditOptions, Analyzer, AuditScoreResult } from "./types/index.js"
export type {
	Evidence,
	EvidenceType,
	Finding,
	FindingCategory,
	Severity,
	Grade,
	ReportFormat,
	AuditReport,
	CategoryScore,
} from "./types/index.js"
