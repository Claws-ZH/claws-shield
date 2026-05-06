import type { ScanContext, ScanFinding, ScanRule } from "@claws-shield/core"

const BASE64_PATTERN =
	/(?:atob|Buffer\.from|base64[_-]?decode)\s*\(\s*['"`]([A-Za-z0-9+\/=]{20,})['"`]/g
const LONG_BASE64 = /['"`]([A-Za-z0-9+\/=]{40,})['"`]/g

export const base64Rule: ScanRule = {
	id: "obfuscation/base64",
	category: "obfuscation",
	severity: "high",
	name: "Base64 Obfuscation",
	description: "Detects base64 encoded strings being decoded at runtime",
	appliesTo: ["*.js", "*.mjs", "*.ts", "*.sh", "*.py"],
	async run(context: ScanContext): Promise<ScanFinding[]> {
		const findings: ScanFinding[] = []
		for (const [file, content] of context.files) {
			// Check for explicit decode calls
			for (const match of content.matchAll(BASE64_PATTERN)) {
				const line = content.slice(0, match.index).split("\n").length
				let decoded = ""
				try {
					decoded = Buffer.from(match[1], "base64").toString("utf-8")
				} catch {}
				findings.push({
					ruleId: "obfuscation/base64",
					category: "obfuscation",
					severity: "high",
					title: "Base64 decode detected",
					description: `Base64 decode in ${file}${decoded ? ` — decodes to: "${decoded.slice(0, 80)}"` : ""}`,
					location: { file, line, snippet: match[0].slice(0, 100) },
					confidence: 0.9,
					recommendation: "Review the decoded content. Obfuscated code is a red flag.",
				})
			}

			// Check for long base64 strings in scripts (not .md)
			if (!file.endsWith(".md")) {
				for (const match of content.matchAll(LONG_BASE64)) {
					if (match[1].length > 60) {
						const line = content.slice(0, match.index).split("\n").length
						findings.push({
							ruleId: "obfuscation/base64",
							category: "obfuscation",
							severity: "medium",
							title: "Long base64 string",
							description: `Suspicious long base64 string (${match[1].length} chars) in ${file}`,
							location: { file, line, snippet: match[0].slice(0, 80) },
							confidence: 0.6,
							recommendation: "Decode and review the content of this string.",
						})
					}
				}
			}
		}
		return findings
	},
}
