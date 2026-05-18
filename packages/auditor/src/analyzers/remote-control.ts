import { readFileSync } from "node:fs"
import { generateId, loadKBFile } from "@claws-shield/core"
import type { AuditContext } from "../engine/audit-context.js"
import type { Analyzer, TargetInfo } from "../types/index.js"

const POLLING_PATTERNS = [
	/setInterval\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{[^}]*(?:fetch|axios|got|request|http)/gis,
	/setInterval\s*\(\s*\w+\s*,\s*\d+/gi,
	/setTimeout\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{[^}]*(?:fetch|axios|got|request|http)/gis,
	/(?:poll|polling|heartbeat|sync|refresh)\s*(?:Interval|Timer|Delay|Frequency)/gi,
]

const MANAGED_SETTINGS_PATTERNS = [
	/(?:fetch|get|axios)\s*\(\s*['"`][^'"`]*(?:config|settings|preferences|feature[_-]?flags|remote[_-]?config)[^'"`]*['"`]/gi,
	/(?:managed|remote|server)[_-]?(?:settings|config|configuration|preferences)/gi,
	/(?:configServiceUrl|settingsEndpoint|remoteConfigUrl|featureFlagUrl)/gi,
]

const FORCE_UPDATE_PATTERNS = [
	/(?:force[_-]?update|must[_-]?update|required[_-]?version|minimum[_-]?version|accept[_-]?or[_-]?die)/gi,
	/(?:blocking|modal|forced)\s*(?:dialog|prompt|update|upgrade)/gi,
	/(?:app|process|window)\s*\.\s*(?:exit|quit|close|terminate)\s*\([^)]*(?:update|version|upgrade)/gi,
	/(?:version|v)\s*[<>=!]+\s*['"`]?\d+\.\d+.*(?:exit|quit|block|disable|kill)/gis,
]

const MODEL_OVERRIDE_PATTERNS = [
	/(?:model|engine)[_-]?(?:override|switch|redirect|reroute|fallback)/gi,
	/(?:override|replace|substitute)\s*(?:model|engine|provider|backend)/gi,
	/(?:server|remote)[_-]?(?:model|engine)[_-]?(?:selection|choice|preference)/gi,
]

const KILLSWITCH_PATTERNS = [
	/(?:kill[_-]?switch|emergency[_-]?stop|remote[_-]?disable|shutdown[_-]?flag)/gi,
	/(?:is[_-]?enabled|is[_-]?active|is[_-]?killed|is[_-]?disabled)\s*\(\s*['"`][^'"`]*(?:kill|emergency|shutdown)/gi,
]

interface ManagedSetting {
	name: string
	endpoint?: string
	pollingInterval?: number
	purpose?: string
}

interface Killswitch {
	name: string
	remoteControlled: boolean
	riskLevel?: string
	purpose?: string
}

export class RemoteControlAnalyzer implements Analyzer {
	readonly name = "remote-control"
	readonly category = "remote_control" as const

	async analyze(ctx: AuditContext, target: TargetInfo): Promise<void> {
		let kbSettings: ManagedSetting[] = []
		let kbKillswitches: Killswitch[] = []
		try {
			kbSettings = loadKBFile<ManagedSetting[]>(ctx.kbRoot, "remote-control/managed-settings.json")
		} catch {
			/* KB not available */
		}
		try {
			kbKillswitches = loadKBFile<Killswitch[]>(ctx.kbRoot, "flags/killswitches.json")
		} catch {
			/* KB not available */
		}

		const pollingHits: Array<{ file: string; line: number; match: string }> = []
		const settingsHits: Array<{ file: string; line: number; match: string }> = []
		const forceUpdateHits: Array<{ file: string; line: number; match: string }> = []
		const modelOverrideHits: Array<{ file: string; line: number; match: string }> = []
		const killswitchHits: Array<{ file: string; line: number; match: string }> = []

		for (const file of target.files) {
			if (file.endsWith(".json") && !file.includes("package.json")) continue

			let content: string
			try {
				content = readFileSync(file, "utf-8")
			} catch {
				continue
			}

			const lines = content.split("\n")

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i]

				for (const pattern of POLLING_PATTERNS) {
					pattern.lastIndex = 0
					let m: RegExpExecArray | null
					while ((m = pattern.exec(line)) !== null) {
						pollingHits.push({ file, line: i + 1, match: m[0] })
						ctx.addEvidence({
							id: generateId("ev"),
							type: "polling_pattern",
							sourceLocation: { file, line: i + 1 },
							value: m[0].slice(0, 200),
							confidence: 0.75,
						})
					}
				}

				for (const pattern of MANAGED_SETTINGS_PATTERNS) {
					pattern.lastIndex = 0
					let m: RegExpExecArray | null
					while ((m = pattern.exec(line)) !== null) {
						settingsHits.push({ file, line: i + 1, match: m[0] })
						ctx.addEvidence({
							id: generateId("ev"),
							type: "polling_pattern",
							sourceLocation: { file, line: i + 1 },
							value: m[0],
							confidence: 0.8,
							metadata: { subtype: "managed_settings" },
						})
					}
				}

				for (const pattern of FORCE_UPDATE_PATTERNS) {
					pattern.lastIndex = 0
					let m: RegExpExecArray | null
					while ((m = pattern.exec(line)) !== null) {
						forceUpdateHits.push({ file, line: i + 1, match: m[0] })
						ctx.addEvidence({
							id: generateId("ev"),
							type: "killswitch",
							sourceLocation: { file, line: i + 1 },
							value: m[0],
							confidence: 0.85,
							metadata: { subtype: "force_update" },
						})
					}
				}

				for (const pattern of MODEL_OVERRIDE_PATTERNS) {
					pattern.lastIndex = 0
					let m: RegExpExecArray | null
					while ((m = pattern.exec(line)) !== null) {
						modelOverrideHits.push({ file, line: i + 1, match: m[0] })
					}
				}

				for (const pattern of KILLSWITCH_PATTERNS) {
					pattern.lastIndex = 0
					let m: RegExpExecArray | null
					while ((m = pattern.exec(line)) !== null) {
						killswitchHits.push({ file, line: i + 1, match: m[0] })
						ctx.addEvidence({
							id: generateId("ev"),
							type: "killswitch",
							sourceLocation: { file, line: i + 1 },
							value: m[0],
							confidence: 0.8,
						})
					}
				}
			}
		}

		// Generate findings
		if (settingsHits.length > 0) {
			const evidenceIds = ctx.evidence
				.filter((e) => e.metadata?.subtype === "managed_settings")
				.map((e) => e.id)
			ctx.addFinding({
				id: generateId("f"),
				category: "remote_control",
				severity: "high",
				title: "Remote managed settings detected",
				description: `Found ${settingsHits.length} reference(s) to remote/managed settings. The tool's behavior can be altered remotely without user consent.`,
				evidenceIds,
				recommendation:
					"Make remote configuration changes transparent and require user opt-in. Provide local overrides.",
			})
		}

		if (pollingHits.length > 0) {
			const evidenceIds = ctx
				.getEvidenceByType("polling_pattern")
				.filter((e) => !e.metadata?.subtype)
				.map((e) => e.id)
			ctx.addFinding({
				id: generateId("f"),
				category: "remote_control",
				severity: "medium",
				title: "Settings polling detected",
				description: `Found ${pollingHits.length} polling pattern(s) that periodically fetch remote configuration or instructions.`,
				evidenceIds,
				recommendation:
					"Document polling behavior and allow users to control polling frequency or disable it.",
			})
		}

		if (forceUpdateHits.length > 0) {
			const evidenceIds = ctx
				.getEvidenceByType("killswitch")
				.filter((e) => e.metadata?.subtype === "force_update")
				.map((e) => e.id)
			ctx.addFinding({
				id: generateId("f"),
				category: "remote_control",
				severity: "critical",
				title: "Accept-or-die force update pattern detected",
				description: `Found ${forceUpdateHits.length} forced update pattern(s). The tool can block usage until the user accepts updates, removing user agency.`,
				evidenceIds,
				recommendation:
					"Allow users to defer updates. Never block tool usage based on version checks.",
				references: ["https://www.eff.org/deeplinks/2023/01/dark-patterns"],
			})
		}

		if (modelOverrideHits.length > 0) {
			ctx.addFinding({
				id: generateId("f"),
				category: "remote_control",
				severity: "medium",
				title: "Remote model override capability",
				description: `Found ${modelOverrideHits.length} pattern(s) allowing remote override of model selection. The AI model used may differ from what the user selected.`,
				evidenceIds: ctx
					.getEvidenceByType("polling_pattern")
					.slice(0, 3)
					.map((e) => e.id),
				recommendation:
					"Always respect user model selection. Log any server-side model substitutions visibly.",
			})
		}

		if (killswitchHits.length > 0) {
			const evidenceIds = ctx
				.getEvidenceByType("killswitch")
				.filter((e) => !e.metadata?.subtype)
				.map((e) => e.id)
			ctx.addFinding({
				id: generateId("f"),
				category: "remote_control",
				severity: "high",
				title: "Kill switch mechanism detected",
				description: `Found ${killswitchHits.length} kill switch pattern(s). Features or the entire tool can be remotely disabled.`,
				evidenceIds,
				recommendation:
					"Document all remote kill capabilities. Provide graceful degradation rather than hard kills.",
			})
		}

		// KB cross-reference
		if (kbKillswitches.length > 0 && killswitchHits.length > 0) {
			ctx.addFinding({
				id: generateId("f"),
				category: "remote_control",
				severity: "info",
				title: "Known kill switches in knowledge base",
				description: `${kbKillswitches.length} kill switch(es) documented in the knowledge base. Cross-referencing with source findings.`,
				evidenceIds: ctx
					.getEvidenceByType("killswitch")
					.slice(0, 3)
					.map((e) => e.id),
			})
		}
	}
}
