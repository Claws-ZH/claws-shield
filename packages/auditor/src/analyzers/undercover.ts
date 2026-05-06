import { readFileSync } from "node:fs"
import { generateId, loadKBFile } from "@claws-shield/core"
import type { AuditContext } from "../engine/audit-context.js"
import type { Analyzer, TargetInfo } from "../types/index.js"

const ATTRIBUTION_STRIP_PATTERNS = [
	/(?:remove|strip|delete|hide|suppress|clean)\s*(?:ai|assistant|generated|claude|gpt|copilot|model)\s*(?:attribution|mention|reference|credit|tag|marker|label)/gi,
	/(?:ai|assistant|generated|claude|gpt|copilot|model)\s*(?:attribution|mention|reference|credit|tag|marker)\s*[=:]\s*(?:false|""|''|null|undefined)/gi,
	/\.replace\s*\(\s*\/[^/]*(?:ai|generated|assistant|copilot|claude)[^/]*\/[gi]*\s*,\s*['"`]['"`]\s*\)/gi,
]

const HUMAN_IMPERSONATION_PATTERNS = [
	/(?:write|respond|act|behave|appear)\s+(?:as\s+(?:a\s+)?(?:human|person|developer|programmer|user)|like\s+(?:a\s+)?(?:human|person))/gi,
	/(?:do\s+not|don't|never|avoid)\s+(?:mention|reveal|disclose|say|indicate)\s+(?:that\s+)?(?:you\s+are|you're)\s+(?:an?\s+)?(?:ai|assistant|bot|model|language\s+model)/gi,
	/(?:pretend|act\s+as\s+if|simulate)\s+(?:you\s+are|being)\s+(?:a\s+)?(?:human|person|developer)/gi,
	/(?:hide|conceal|mask)\s+(?:ai|artificial|machine|model)\s+(?:identity|nature|origin|involvement)/gi,
]

const COMMIT_MANIPULATION_PATTERNS = [
	/(?:git|commit)\s*(?:message|msg|author|email)\s*[=:]\s*(?!.*(?:ai|bot|generated|assistant))/gi,
	/(?:set|change|override|replace)\s*(?:commit\s*)?(?:author|committer)\s*(?:name|email|identity)/gi,
	/GIT_AUTHOR_NAME|GIT_COMMITTER_NAME|GIT_AUTHOR_EMAIL|GIT_COMMITTER_EMAIL/g,
	/(?:remove|strip|clean|filter)\s*(?:co-authored|generated)[_-]?by/gi,
]

const GHOSTWRITING_PATTERNS = [
	/(?:ghostwrit|ghost[_-]?writ|ghost[_-]?mode)/gi,
	/(?:attribution|credit|authorship)\s*[=:]\s*(?:false|"none"|'none'|null|"user"|'user')/gi,
	/(?:present|display|show)\s+(?:as\s+)?(?:user[_-]?(?:written|authored|created)|original\s+(?:work|content))/gi,
]

interface UndercoverRule {
	id: string
	pattern?: string
	description?: string
	severity?: string
}

export class UndercoverAnalyzer implements Analyzer {
	readonly name = "undercover"
	readonly category = "undercover" as const

	async analyze(ctx: AuditContext, target: TargetInfo): Promise<void> {
		let kbRules: UndercoverRule[] = []
		try {
			kbRules = loadKBFile<UndercoverRule[]>(ctx.kbRoot, "undercover/activation-rules.json")
		} catch {
			/* KB not available */
		}

		const attributionHits: Array<{ file: string; line: number; match: string }> = []
		const impersonationHits: Array<{ file: string; line: number; match: string }> = []
		const commitHits: Array<{ file: string; line: number; match: string }> = []
		const ghostwritingHits: Array<{ file: string; line: number; match: string }> = []

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

				for (const pattern of ATTRIBUTION_STRIP_PATTERNS) {
					pattern.lastIndex = 0
					let m: RegExpExecArray | null
					while ((m = pattern.exec(line)) !== null) {
						attributionHits.push({ file, line: i + 1, match: m[0] })
						ctx.addEvidence({
							id: generateId("ev"),
							type: "attribution_rule",
							sourceLocation: { file, line: i + 1 },
							value: m[0],
							confidence: 0.85,
							metadata: { subtype: "attribution_stripping" },
						})
					}
				}

				for (const pattern of HUMAN_IMPERSONATION_PATTERNS) {
					pattern.lastIndex = 0
					let m: RegExpExecArray | null
					while ((m = pattern.exec(line)) !== null) {
						impersonationHits.push({ file, line: i + 1, match: m[0] })
						ctx.addEvidence({
							id: generateId("ev"),
							type: "prompt_signature",
							sourceLocation: { file, line: i + 1 },
							value: m[0],
							confidence: 0.8,
							metadata: { subtype: "impersonation" },
						})
					}
				}

				for (const pattern of COMMIT_MANIPULATION_PATTERNS) {
					pattern.lastIndex = 0
					let m: RegExpExecArray | null
					while ((m = pattern.exec(line)) !== null) {
						commitHits.push({ file, line: i + 1, match: m[0] })
						ctx.addEvidence({
							id: generateId("ev"),
							type: "attribution_rule",
							sourceLocation: { file, line: i + 1 },
							value: m[0],
							confidence: 0.7,
							metadata: { subtype: "commit_manipulation" },
						})
					}
				}

				for (const pattern of GHOSTWRITING_PATTERNS) {
					pattern.lastIndex = 0
					let m: RegExpExecArray | null
					while ((m = pattern.exec(line)) !== null) {
						ghostwritingHits.push({ file, line: i + 1, match: m[0] })
						ctx.addEvidence({
							id: generateId("ev"),
							type: "prompt_signature",
							sourceLocation: { file, line: i + 1 },
							value: m[0],
							confidence: 0.75,
							metadata: { subtype: "ghostwriting" },
						})
					}
				}
			}
		}

		// Generate findings
		if (attributionHits.length > 0) {
			const evidenceIds = ctx.evidence
				.filter((e) => e.metadata?.subtype === "attribution_stripping")
				.map((e) => e.id)
			ctx.addFinding({
				id: generateId("f"),
				category: "undercover",
				severity: "high",
				title: "AI attribution stripping detected",
				description: `Found ${attributionHits.length} pattern(s) that remove or suppress AI attribution from generated content. This hides AI involvement from end users.`,
				evidenceIds,
				recommendation:
					"Always maintain transparent AI attribution. Allow users to choose disclosure level.",
			})
		}

		if (impersonationHits.length > 0) {
			const evidenceIds = ctx.evidence
				.filter((e) => e.metadata?.subtype === "impersonation")
				.map((e) => e.id)
			ctx.addFinding({
				id: generateId("f"),
				category: "undercover",
				severity: "high",
				title: "Human impersonation instructions detected",
				description: `Found ${impersonationHits.length} pattern(s) instructing the AI to present as human or hide its AI nature.`,
				evidenceIds,
				recommendation:
					"Remove instructions that direct AI to impersonate humans. Be transparent about AI involvement.",
				references: ["EU AI Act Article 52"],
			})
		}

		if (commitHits.length > 0) {
			const evidenceIds = ctx.evidence
				.filter((e) => e.metadata?.subtype === "commit_manipulation")
				.map((e) => e.id)
			ctx.addFinding({
				id: generateId("f"),
				category: "undercover",
				severity: "medium",
				title: "Git commit attribution manipulation",
				description: `Found ${commitHits.length} pattern(s) that may alter git commit authorship or remove AI co-authorship markers.`,
				evidenceIds,
				recommendation: "Preserve AI co-authorship in git commits (e.g., Co-Authored-By headers).",
			})
		}

		if (ghostwritingHits.length > 0) {
			const evidenceIds = ctx.evidence
				.filter((e) => e.metadata?.subtype === "ghostwriting")
				.map((e) => e.id)
			ctx.addFinding({
				id: generateId("f"),
				category: "undercover",
				severity: "medium",
				title: "Ghostwriting mode detected",
				description: `Found ${ghostwritingHits.length} ghostwriting pattern(s) that present AI-generated content as user-authored.`,
				evidenceIds,
				recommendation:
					"Provide clear options for users to decide on attribution rather than defaulting to hidden AI authorship.",
			})
		}

		// KB cross-reference
		if (kbRules.length > 0 && (attributionHits.length > 0 || impersonationHits.length > 0)) {
			ctx.addFinding({
				id: generateId("f"),
				category: "undercover",
				severity: "info",
				title: "Known undercover activation rules",
				description: `${kbRules.length} undercover activation rule(s) documented in the knowledge base for this tool.`,
				evidenceIds: ctx
					.getEvidenceByType("attribution_rule")
					.slice(0, 3)
					.map((e) => e.id),
			})
		}
	}
}
