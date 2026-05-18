import { readFileSync } from "node:fs"
import { generateId } from "@claws-shield/core"
import type { AuditContext } from "../engine/audit-context.js"
import type { Analyzer, TargetInfo } from "../types/index.js"

const URL_PATTERN = /https?:\/\/[^\s"'`<>\]\)}{,;]+/gi

const FIRST_PARTY_DOMAINS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"])

const DATA_EXFIL_PATTERNS = [
	/(?:fetch|axios|got|request|http\.request)\s*\(\s*[^)]*(?:POST|PUT|PATCH)[^)]*(?:env|user|token|key|secret|credential|password|auth)/gis,
	/(?:method|type)\s*:\s*['"`](?:POST|PUT|PATCH)['"`][^}]*(?:body|data|payload)\s*:\s*[^}]*(?:process\.env|os\.|homedir|userInfo)/gis,
	/(?:fetch|axios|got)\s*\(\s*['"`][^'"`]+['"`]\s*,\s*\{[^}]*method\s*:\s*['"`]POST['"`]/gis,
]

const HIGH_FREQUENCY_PATTERNS = [
	/setInterval\s*\([^,]+,\s*(\d+)\s*\)/g,
	/(?:poll|ping|heartbeat|beacon)\s*(?:Interval|Timer|Delay)\s*[=:]\s*(\d+)/gi,
]

export class NetworkAnalyzer implements Analyzer {
	readonly name = "network"
	readonly category = "network" as const

	async analyze(ctx: AuditContext, target: TargetInfo): Promise<void> {
		const allUrls = new Map<string, Array<{ file: string; line: number }>>()
		const exfilHits: Array<{ file: string; line: number; match: string }> = []
		const frequencyHits: Array<{ file: string; line: number; interval: number }> = []

		for (const file of target.files) {
			if (file.endsWith(".md")) continue

			let content: string
			try {
				content = readFileSync(file, "utf-8")
			} catch {
				continue
			}

			const lines = content.split("\n")

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i]

				URL_PATTERN.lastIndex = 0
				let m: RegExpExecArray | null
				while ((m = URL_PATTERN.exec(line)) !== null) {
					const url = m[0].replace(/[.,;:!?)]+$/, "")
					if (!allUrls.has(url)) allUrls.set(url, [])
					allUrls.get(url)?.push({ file, line: i + 1 })

					ctx.addEvidence({
						id: generateId("ev"),
						type: "endpoint",
						sourceLocation: { file, line: i + 1 },
						value: url,
						confidence: 0.7,
						metadata: { analyzerSource: "network" },
					})
				}

				for (const pattern of DATA_EXFIL_PATTERNS) {
					pattern.lastIndex = 0
					let em: RegExpExecArray | null
					while ((em = pattern.exec(line)) !== null) {
						exfilHits.push({ file, line: i + 1, match: em[0].slice(0, 200) })
					}
				}

				for (const pattern of HIGH_FREQUENCY_PATTERNS) {
					pattern.lastIndex = 0
					let fm: RegExpExecArray | null
					while ((fm = pattern.exec(line)) !== null) {
						const interval = Number.parseInt(fm[1], 10)
						if (interval > 0 && interval < 30000) {
							frequencyHits.push({ file, line: i + 1, interval })
						}
					}
				}
			}
		}

		// Classify URLs
		const thirdPartyUrls: string[] = []
		const firstPartyUrls: string[] = []

		for (const url of allUrls.keys()) {
			try {
				const parsed = new URL(url)
				if (FIRST_PARTY_DOMAINS.has(parsed.hostname)) {
					firstPartyUrls.push(url)
				} else {
					thirdPartyUrls.push(url)
				}
			} catch {
				thirdPartyUrls.push(url)
			}
		}

		// Deduplicate domains
		const thirdPartyDomains = new Set<string>()
		for (const url of thirdPartyUrls) {
			try {
				thirdPartyDomains.add(new URL(url).hostname)
			} catch {
				/* skip */
			}
		}

		// Findings
		if (thirdPartyDomains.size > 5) {
			const evidenceIds = ctx.evidence
				.filter((e) => e.metadata?.analyzerSource === "network")
				.slice(0, 10)
				.map((e) => e.id)
			ctx.addFinding({
				id: generateId("f"),
				category: "network",
				severity: "medium",
				title: "Extensive third-party network connections",
				description: `Found ${thirdPartyDomains.size} unique third-party domain(s) contacted: ${[...thirdPartyDomains].slice(0, 10).join(", ")}${thirdPartyDomains.size > 10 ? "..." : ""}`,
				evidenceIds,
				recommendation:
					"Document all third-party connections. Minimize external dependencies and data sharing.",
			})
		}

		if (exfilHits.length > 0) {
			ctx.addFinding({
				id: generateId("f"),
				category: "network",
				severity: "high",
				title: "Potential data exfiltration pattern",
				description: `Found ${exfilHits.length} pattern(s) where sensitive data (env vars, user info, tokens) may be sent via HTTP POST.`,
				evidenceIds: ctx.evidence
					.filter((e) => e.metadata?.analyzerSource === "network")
					.slice(0, 5)
					.map((e) => e.id),
				recommendation:
					"Review all outbound POST requests. Never transmit credentials, tokens, or sensitive environment data.",
			})
		}

		if (frequencyHits.length > 0) {
			const minInterval = Math.min(...frequencyHits.map((h) => h.interval))
			ctx.addFinding({
				id: generateId("f"),
				category: "network",
				severity: "low",
				title: "High-frequency network requests",
				description: `Found ${frequencyHits.length} high-frequency request pattern(s) with intervals as low as ${minInterval}ms.`,
				evidenceIds: ctx.evidence
					.filter((e) => e.metadata?.analyzerSource === "network")
					.slice(0, 3)
					.map((e) => e.id),
				recommendation:
					"Use reasonable polling intervals. Consider server-sent events or webhooks instead of polling.",
			})
		}

		if (allUrls.size > 0) {
			ctx.addFinding({
				id: generateId("f"),
				category: "network",
				severity: "info",
				title: "Network connection summary",
				description: `Total: ${allUrls.size} unique URL(s), ${firstPartyUrls.length} first-party, ${thirdPartyUrls.length} third-party across ${thirdPartyDomains.size} domain(s).`,
				evidenceIds: ctx.evidence
					.filter((e) => e.metadata?.analyzerSource === "network")
					.slice(0, 5)
					.map((e) => e.id),
			})
		}
	}
}
