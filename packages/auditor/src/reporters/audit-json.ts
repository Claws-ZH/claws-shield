import type { AuditReport } from "@claws-shield/core"

export function formatJson(report: AuditReport): string {
	return JSON.stringify(report, null, 2)
}
