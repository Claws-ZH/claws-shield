import { readFileSync } from "node:fs"
import { generateId, loadKBFile } from "@claws-shield/core"
import type { AuditContext } from "../engine/audit-context.js"
import type { Analyzer, TargetInfo } from "../types/index.js"

const FEATURE_FLAG_PATTERNS = [
	/(?:feature[_-]?flag|ff|flag)\s*[\([\.:=]\s*['"`]([^'"`]+)['"`]/gi,
	/(?:isEnabled|isActive|hasFeature|getFeature|checkFeature|featureEnabled)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
	/(?:FEATURE|FLAG|FF)[_A-Z]+\s*[=:]\s*['"`]?(?:true|false|on|off)['"`]?/gi,
	/tengu_\w+/gi,
	/(?:experiment|variant|ab_test|split_test)\s*[\([\.:=]\s*['"`]([^'"`]+)['"`]/gi,
]

const TOOL_REFERENCE_PATTERNS = [
	/(?:tool|capability|skill|action|function)\s*:\s*['"`]([^'"`]+)['"`]/gi,
	/(?:registerTool|addTool|defineTool|createTool)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
	/(?:tools|capabilities|skills|actions)\s*\.\s*(?:push|add|register)\s*\(\s*\{[^}]*name\s*:\s*['"`]([^'"`]+)['"`]/gi,
]

const UNRELEASED_MARKERS = [
	/(?:unreleased|upcoming|beta|alpha|preview|experimental|internal[_-]?only|coming[_-]?soon|wip|todo[_-]?launch)/gi,
	/(?:UNRELEASED|INTERNAL|DO_NOT_SHIP|NOT_FOR_RELEASE|HIDDEN|SECRET)/g,
]

interface UnreleasedTool {
	name: string
	description?: string
	featureFlags?: string[]
	status?: string
	capabilityArea?: string
}

interface FeatureFlag {
	flag: string
	decodedPurpose?: string
	category?: string
	riskLevel?: string
}

export class HiddenToolsAnalyzer implements Analyzer {
	readonly name = "hidden-tools"
	readonly category = "hidden_features" as const

	async analyze(ctx: AuditContext, target: TargetInfo): Promise<void> {
		let kbTools: UnreleasedTool[] = []
		let kbFlags: FeatureFlag[] = []
		try {
			kbTools = loadKBFile<UnreleasedTool[]>(ctx.kbRoot, "hidden-features/unreleased-tools.json")
		} catch {
			/* KB not available */
		}
		try {
			kbFlags = loadKBFile<FeatureFlag[]>(ctx.kbRoot, "flags/feature-flags.json")
		} catch {
			/* KB not available */
		}

		const flagHits: Array<{ file: string; line: number; match: string }> = []
		const toolRefHits: Array<{ file: string; line: number; match: string }> = []
		const unreleasedHits: Array<{ file: string; line: number; match: string }> = []

		const kbFlagNames = new Set(kbFlags.map((f) => f.flag.toLowerCase()))
		const kbToolNames = new Set(kbTools.map((t) => t.name.toLowerCase()))

		for (const file of target.files) {
			let content: string
			try {
				content = readFileSync(file, "utf-8")
			} catch {
				continue
			}

			const lines = content.split("\n")

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i]

				for (const pattern of FEATURE_FLAG_PATTERNS) {
					pattern.lastIndex = 0
					let m: RegExpExecArray | null
					while ((m = pattern.exec(line)) !== null) {
						const flagValue = m[1] ?? m[0]
						flagHits.push({ file, line: i + 1, match: flagValue })
						ctx.addEvidence({
							id: generateId("ev"),
							type: "feature_flag",
							sourceLocation: { file, line: i + 1 },
							value: flagValue,
							confidence: kbFlagNames.has(flagValue.toLowerCase()) ? 0.95 : 0.6,
							metadata: { kbMatch: kbFlagNames.has(flagValue.toLowerCase()) },
						})
					}
				}

				for (const pattern of TOOL_REFERENCE_PATTERNS) {
					pattern.lastIndex = 0
					let m: RegExpExecArray | null
					while ((m = pattern.exec(line)) !== null) {
						const toolName = m[1] ?? m[0]
						toolRefHits.push({ file, line: i + 1, match: toolName })
						ctx.addEvidence({
							id: generateId("ev"),
							type: "tool_reference",
							sourceLocation: { file, line: i + 1 },
							value: toolName,
							confidence: kbToolNames.has(toolName.toLowerCase()) ? 0.9 : 0.5,
							metadata: { kbMatch: kbToolNames.has(toolName.toLowerCase()) },
						})
					}
				}

				for (const pattern of UNRELEASED_MARKERS) {
					pattern.lastIndex = 0
					let m: RegExpExecArray | null
					while ((m = pattern.exec(line)) !== null) {
						unreleasedHits.push({ file, line: i + 1, match: m[0] })
					}
				}
			}
		}

		// KB-matched flags
		const kbMatchedFlags = flagHits.filter((h) => kbFlagNames.has(h.match.toLowerCase()))
		if (kbMatchedFlags.length > 0) {
			const evidenceIds = ctx.evidence
				.filter((e) => e.type === "feature_flag" && e.metadata?.kbMatch)
				.map((e) => e.id)
			ctx.addFinding({
				id: generateId("f"),
				category: "hidden_features",
				severity: "medium",
				title: "Hidden feature flags matched from knowledge base",
				description: `Found ${kbMatchedFlags.length} feature flag(s) matching the knowledge base: ${kbMatchedFlags
					.slice(0, 5)
					.map((h) => h.match)
					.join(", ")}`,
				evidenceIds,
				recommendation: "Document all feature flags publicly. Allow users to inspect active flags.",
			})
		}

		if (flagHits.length > kbMatchedFlags.length) {
			const unknownCount = flagHits.length - kbMatchedFlags.length
			const evidenceIds = ctx.evidence
				.filter((e) => e.type === "feature_flag" && !e.metadata?.kbMatch)
				.slice(0, 10)
				.map((e) => e.id)
			ctx.addFinding({
				id: generateId("f"),
				category: "hidden_features",
				severity: "low",
				title: "Undocumented feature flags detected",
				description: `Found ${unknownCount} feature flag(s) not in the knowledge base. These may control hidden or unreleased functionality.`,
				evidenceIds,
				recommendation: "Maintain a public feature flag registry for transparency.",
			})
		}

		// KB-matched tools
		const kbMatchedTools = toolRefHits.filter((h) => kbToolNames.has(h.match.toLowerCase()))
		if (kbMatchedTools.length > 0) {
			const evidenceIds = ctx.evidence
				.filter((e) => e.type === "tool_reference" && e.metadata?.kbMatch)
				.map((e) => e.id)
			ctx.addFinding({
				id: generateId("f"),
				category: "hidden_features",
				severity: "medium",
				title: "Unreleased tool references found",
				description: `Found ${kbMatchedTools.length} reference(s) to known unreleased tools: ${kbMatchedTools
					.slice(0, 5)
					.map((h) => h.match)
					.join(", ")}`,
				evidenceIds,
				recommendation:
					"Clearly mark unreleased features and obtain user consent before enabling them.",
			})
		}

		if (unreleasedHits.length > 0) {
			ctx.addFinding({
				id: generateId("f"),
				category: "hidden_features",
				severity: "info",
				title: "Unreleased/experimental markers found",
				description: `Found ${unreleasedHits.length} marker(s) indicating unreleased or experimental features in the codebase.`,
				evidenceIds: ctx
					.getEvidenceByType("feature_flag")
					.slice(0, 5)
					.map((e) => e.id),
			})
		}
	}
}
