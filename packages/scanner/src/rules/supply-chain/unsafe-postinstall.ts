import type { ScanContext, ScanFinding, ScanRule } from "@claws-shield/core"

export const unsafePostinstallRule: ScanRule = {
	id: "supply-chain/unsafe-postinstall",
	category: "supply_chain",
	severity: "high",
	name: "Unsafe Postinstall Script",
	description: "Detects potentially dangerous lifecycle scripts in package.json",
	appliesTo: ["package.json"],
	async run(context: ScanContext): Promise<ScanFinding[]> {
		const findings: ScanFinding[] = []
		const pkg = context.packageJson
		if (!pkg?.scripts) return findings

		const dangerousScripts = ["preinstall", "postinstall", "preuninstall", "postuninstall"]
		const scripts = pkg.scripts as Record<string, string>

		for (const hook of dangerousScripts) {
			if (scripts[hook]) {
				const cmd = scripts[hook]
				const suspicious = /curl|wget|node\s+-e|python|bash\s+-c|eval|exec/.test(cmd)
				findings.push({
					ruleId: "supply-chain/unsafe-postinstall",
					category: "supply_chain",
					severity: suspicious ? "critical" : "medium",
					title: `Lifecycle script: ${hook}`,
					description: `package.json has "${hook}" script: "${cmd.slice(0, 100)}"`,
					location: { file: "package.json", snippet: `${hook}: ${cmd.slice(0, 80)}` },
					confidence: suspicious ? 0.9 : 0.5,
					recommendation:
						"Review lifecycle scripts carefully. They run automatically during install.",
				})
			}
		}
		return findings
	},
}
