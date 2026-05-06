import type {
	AuditReport,
	CategoryScore,
	Evidence,
	EvidenceType,
	Finding,
	FindingCategory,
	Grade,
	ReportFormat,
	Severity,
} from "@claws-shield/core"

export interface TargetInfo {
	path: string
	files: string[]
	totalLines: number
	toolName?: string
	toolVersion?: string
}

export interface AuditOptions {
	kbRoot?: string
	analyzers?: string[]
	format?: ReportFormat
}

export interface Analyzer {
	name: string
	category: FindingCategory
	analyze(ctx: import("../engine/audit-context.js").AuditContext, target: TargetInfo): Promise<void>
}

export interface AuditScoreResult {
	categories: Record<FindingCategory, CategoryScore>
	overall: { score: number; grade: Grade }
}

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
}
