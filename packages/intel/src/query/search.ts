import type { IntelDatabase } from "../loader/load-kb.js"

export interface SearchResult {
	type: "flag" | "killswitch" | "codename" | "tool" | "endpoint" | "undercover"
	item: any
	matchField: string
	matchValue: string
}

export function searchAll(db: IntelDatabase, query: string): SearchResult[] {
	const q = query.toLowerCase()
	const results: SearchResult[] = []

	for (const flag of db.featureFlags) {
		if (
			flag.flag.toLowerCase().includes(q) ||
			flag.decodedPurpose.toLowerCase().includes(q) ||
			flag.description.toLowerCase().includes(q)
		) {
			results.push({ type: "flag", item: flag, matchField: "flag", matchValue: flag.flag })
		}
	}

	for (const ks of db.killswitches) {
		if (ks.name.toLowerCase().includes(q) || ks.purpose.toLowerCase().includes(q)) {
			results.push({ type: "killswitch", item: ks, matchField: "name", matchValue: ks.name })
		}
	}

	for (const cn of db.codenames) {
		if (
			cn.codename.toLowerCase().includes(q) ||
			cn.mapsTo?.toLowerCase().includes(q) ||
			cn.usage.toLowerCase().includes(q)
		) {
			results.push({ type: "codename", item: cn, matchField: "codename", matchValue: cn.codename })
		}
	}

	for (const tool of db.unreleasedTools) {
		if (
			tool.name.toLowerCase().includes(q) ||
			tool.description.toLowerCase().includes(q) ||
			tool.capabilityArea.toLowerCase().includes(q)
		) {
			results.push({ type: "tool", item: tool, matchField: "name", matchValue: tool.name })
		}
	}

	for (const ep of db.telemetryEndpoints) {
		if (
			ep.url.toLowerCase().includes(q) ||
			ep.host.toLowerCase().includes(q) ||
			ep.classification.toLowerCase().includes(q)
		) {
			results.push({ type: "endpoint", item: ep, matchField: "url", matchValue: ep.url })
		}
	}

	for (const rule of db.undercoverRules) {
		if (JSON.stringify(rule).toLowerCase().includes(q)) {
			results.push({ type: "undercover", item: rule, matchField: "id", matchValue: rule.id })
		}
	}

	return results
}
