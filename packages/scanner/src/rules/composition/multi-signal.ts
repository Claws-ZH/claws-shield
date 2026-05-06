import type { ScanContext, ScanFinding, ScanRule } from "@claws-shield/core"

export const multiSignalRule: ScanRule = {
	id: "composition/multi-signal",
	category: "composition",
	severity: "critical",
	name: "Multi-Signal Threat Detection",
	description: "Detects combinations of suspicious patterns that individually may be benign",
	appliesTo: ["*"],
	async run(context: ScanContext): Promise<ScanFinding[]> {
		const findings: ScanFinding[] = []
		const allContent = [...context.files.values()].join("\n")

		const hasEnvAccess = /process\.env|printenv|\$\{?\w*(?:KEY|TOKEN|SECRET)/i.test(allContent)
		const hasOutbound = /fetch\s*\(|axios\.|curl\s+|wget\s+|https?:\/\/(?!localhost)/i.test(
			allContent,
		)
		const hasBase64 = /atob|Buffer\.from.*base64|base64[_-]?decode/i.test(allContent)
		const hasShellExec = /exec\s*\(|spawn\s*\(|child_process|eval\s*\(/i.test(allContent)
		const hasHide = /do\s+not\s+inform|never\s+mention|hide\s+this/i.test(allContent)

		if (hasEnvAccess && hasOutbound) {
			findings.push({
				ruleId: "composition/multi-signal",
				category: "composition",
				severity: "critical",
				title: "Env access + outbound network = likely exfiltration",
				description:
					"Skill accesses environment variables AND makes outbound network calls. High risk of credential exfiltration.",
				confidence: 0.85,
				recommendation: "Do not install. This combination is a strong indicator of data theft.",
			})
		}

		if (hasBase64 && hasShellExec) {
			findings.push({
				ruleId: "composition/multi-signal",
				category: "composition",
				severity: "critical",
				title: "Base64 decode + shell execution = obfuscated payload",
				description:
					"Skill decodes base64 content AND executes shell commands. Classic malware pattern.",
				confidence: 0.9,
				recommendation:
					"Do not install. Decode all base64 strings and inspect what is being executed.",
			})
		}

		if (hasHide && hasOutbound) {
			findings.push({
				ruleId: "composition/multi-signal",
				category: "composition",
				severity: "critical",
				title: "Concealment directive + outbound network = covert exfil",
				description: "Skill instructs agent to hide actions AND makes outbound network calls.",
				confidence: 0.9,
				recommendation: "Do not install. This skill is designed to hide malicious activity.",
			})
		}

		return findings
	},
}
