import type { ScanContext, ScanFinding, ScanRule } from "@claws-shield/core"

const EXFIL_PATTERNS = [
	{
		pattern: /process\.env(?!\[['"](?:NODE_ENV|PATH|HOME|SHELL|TERM|USER|LANG)\b)/g,
		desc: "process.env access",
	},
	{
		pattern: /\$\{?(?:API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|AUTH)/gi,
		desc: "secret variable reference",
	},
	{ pattern: /printenv|env\s*\|/g, desc: "environment dump command" },
	{ pattern: /JSON\.stringify\s*\(\s*process\.env/g, desc: "full env serialization" },
]

export const envDumpRule: ScanRule = {
	id: "exfil/env-dump",
	category: "exfil",
	severity: "high",
	name: "Environment Variable Exfiltration",
	description: "Detects patterns that access or dump environment variables containing secrets",
	appliesTo: ["*.js", "*.mjs", "*.ts", "*.sh", "*.py"],
	async run(context: ScanContext): Promise<ScanFinding[]> {
		const findings: ScanFinding[] = []
		for (const [file, content] of context.files) {
			for (const { pattern, desc } of EXFIL_PATTERNS) {
				pattern.lastIndex = 0
				const match = pattern.exec(content)
				if (match) {
					const line = content.slice(0, match.index).split("\n").length
					findings.push({
						ruleId: "exfil/env-dump",
						category: "exfil",
						severity: desc.includes("serialization") || desc.includes("dump") ? "critical" : "high",
						title: `Env exfil: ${desc}`,
						description: `Detected ${desc} in ${file}`,
						location: { file, line, snippet: match[0].slice(0, 100) },
						confidence: 0.7,
						recommendation:
							"Verify this env access is necessary and data isn't being sent externally.",
					})
				}
			}
		}
		return findings
	},
}
