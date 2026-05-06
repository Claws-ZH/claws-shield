import type { Grade, Severity } from "./common.js"
import type { Evidence } from "./evidence.js"
import type { Finding, FindingCategory } from "./finding.js"

export interface CategoryScore {
	grade: Grade
	score: number // 0-100
	issueCount: number
	findings: Finding[]
}

export interface AuditReport {
	tool: string
	version?: string
	auditDate: string
	overallGrade: Grade
	overallScore: number
	categories: Record<FindingCategory, CategoryScore>
	findings: Finding[]
	evidence: Evidence[]
	recommendations: string[]
	metadata: {
		engineVersion: string
		kbVersion: string
		analyzersRun: string[]
		duration: number
	}
}

export interface ScanReport {
	skill: string
	version?: string
	scanDate: string
	securityGrade: Grade
	securityScore: number
	issues: Finding[]
	safeToInstall: boolean
	manualReviewRequired: boolean
	confidence: number
	metadata: {
		engineVersion: string
		rulesRun: number
		filesScanned: number
		duration: number
	}
}
