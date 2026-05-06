import type { Evidence, EvidenceType, Finding, FindingCategory } from "@claws-shield/core"
import { findKBRoot } from "@claws-shield/core"

export class AuditContext {
	readonly targetPath: string
	readonly evidence: Evidence[] = []
	readonly findings: Finding[] = []
	readonly kbRoot: string

	constructor(targetPath: string, kbRoot?: string) {
		this.targetPath = targetPath
		this.kbRoot = kbRoot ?? findKBRoot()
	}

	addEvidence(e: Evidence): void {
		this.evidence.push(e)
	}

	addFinding(f: Finding): void {
		this.findings.push(f)
	}

	getEvidenceByType(type: EvidenceType): Evidence[] {
		return this.evidence.filter((e) => e.type === type)
	}

	getFindingsByCategory(cat: FindingCategory): Finding[] {
		return this.findings.filter((f) => f.category === cat)
	}
}
