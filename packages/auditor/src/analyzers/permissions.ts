import { readFileSync } from "node:fs"
import { generateId } from "@claws-shield/core"
import type { AuditContext } from "../engine/audit-context.js"
import type { Analyzer, TargetInfo } from "../types/index.js"

const FS_ACCESS_PATTERNS = [
	/(?:fs|fse|fs-extra|graceful-fs)\s*\.\s*(?:readFile|writeFile|readdir|mkdir|rmdir|unlink|rename|stat|access|chmod|chown|copyFile|appendFile|createReadStream|createWriteStream)/gi,
	/(?:import|require)\s*\(?['"][^'"]*(?:fs|fs-extra|graceful-fs|fs\/promises)['"]\)?/gi,
	/(?:readFileSync|writeFileSync|readdirSync|mkdirSync|rmdirSync|unlinkSync|renameSync|statSync|accessSync)/gi,
]

const SHELL_EXEC_PATTERNS = [
	/(?:child_process|execa|shelljs)\s*\.\s*(?:exec|execSync|spawn|spawnSync|fork|execFile|execFileSync)/gi,
	/(?:import|require)\s*\(?['"][^'"]*(?:child_process|execa|shelljs)['"]\)?/gi,
	/(?:exec|execSync|spawn|spawnSync)\s*\(\s*['"`]/gi,
	/\$\s*\(\s*['"`]|`[^`]*\$\{[^}]*exec/gi,
]

const NETWORK_PERMISSION_PATTERNS = [
	/(?:net|dgram|tls|https?)\s*\.\s*(?:createServer|createConnection|connect|listen|request)/gi,
	/(?:import|require)\s*\(?['"][^'"]*(?:net|dgram|tls)['"]\)?/gi,
	/new\s+(?:WebSocket|EventSource|XMLHttpRequest)\s*\(/gi,
]

const ELEVATED_ACCESS_PATTERNS = [
	/(?:sudo|runas|admin|root|elevate|privilege)/gi,
	/process\s*\.\s*(?:setuid|setgid|setgroups|initgroups)/gi,
	/(?:chmod|chown)\s*\(\s*['"`][^'"`]*['"`]\s*,\s*(?:0o?7|777|755|644)/gi,
]

const SENSITIVE_PATH_PATTERNS = [
	/(?:\/etc\/passwd|\/etc\/shadow|~\/\.ssh|~\/\.aws|~\/\.gnupg|~\/\.config)/g,
	/(?:\.env|\.env\.local|\.env\.production|credentials|secrets|private[_-]?key)/gi,
	/(?:HOME|USERPROFILE|APPDATA|XDG_CONFIG_HOME)\s*[\+\/]/gi,
]

export class PermissionsAnalyzer implements Analyzer {
	readonly name = "permissions"
	readonly category = "permissions" as const

	async analyze(ctx: AuditContext, target: TargetInfo): Promise<void> {
		const fsHits: Array<{ file: string; line: number; match: string }> = []
		const shellHits: Array<{ file: string; line: number; match: string }> = []
		const networkHits: Array<{ file: string; line: number; match: string }> = []
		const elevatedHits: Array<{ file: string; line: number; match: string }> = []
		const sensitivePathHits: Array<{ file: string; line: number; match: string }> = []

		for (const file of target.files) {
			if (file.endsWith(".json") || file.endsWith(".md")) continue

			let content: string
			try {
				content = readFileSync(file, "utf-8")
			} catch {
				continue
			}

			const lines = content.split("\n")

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i]

				for (const pattern of FS_ACCESS_PATTERNS) {
					pattern.lastIndex = 0
					let m: RegExpExecArray | null
					while ((m = pattern.exec(line)) !== null) {
						fsHits.push({ file, line: i + 1, match: m[0] })
						ctx.addEvidence({
							id: generateId("ev"),
							type: "permission_request",
							sourceLocation: { file, line: i + 1 },
							value: m[0],
							confidence: 0.8,
							metadata: { permissionType: "filesystem" },
						})
					}
				}

				for (const pattern of SHELL_EXEC_PATTERNS) {
					pattern.lastIndex = 0
					let m: RegExpExecArray | null
					while ((m = pattern.exec(line)) !== null) {
						shellHits.push({ file, line: i + 1, match: m[0] })
						ctx.addEvidence({
							id: generateId("ev"),
							type: "permission_request",
							sourceLocation: { file, line: i + 1 },
							value: m[0],
							confidence: 0.9,
							metadata: { permissionType: "shell" },
						})
					}
				}

				for (const pattern of NETWORK_PERMISSION_PATTERNS) {
					pattern.lastIndex = 0
					let m: RegExpExecArray | null
					while ((m = pattern.exec(line)) !== null) {
						networkHits.push({ file, line: i + 1, match: m[0] })
						ctx.addEvidence({
							id: generateId("ev"),
							type: "permission_request",
							sourceLocation: { file, line: i + 1 },
							value: m[0],
							confidence: 0.75,
							metadata: { permissionType: "network" },
						})
					}
				}

				for (const pattern of ELEVATED_ACCESS_PATTERNS) {
					pattern.lastIndex = 0
					let m: RegExpExecArray | null
					while ((m = pattern.exec(line)) !== null) {
						elevatedHits.push({ file, line: i + 1, match: m[0] })
					}
				}

				for (const pattern of SENSITIVE_PATH_PATTERNS) {
					pattern.lastIndex = 0
					let m: RegExpExecArray | null
					while ((m = pattern.exec(line)) !== null) {
						sensitivePathHits.push({ file, line: i + 1, match: m[0] })
						ctx.addEvidence({
							id: generateId("ev"),
							type: "permission_request",
							sourceLocation: { file, line: i + 1 },
							value: m[0],
							confidence: 0.7,
							metadata: { permissionType: "sensitive_path" },
						})
					}
				}
			}
		}

		// Findings
		if (shellHits.length > 0) {
			const evidenceIds = ctx.evidence
				.filter((e) => e.metadata?.permissionType === "shell")
				.map((e) => e.id)
			ctx.addFinding({
				id: generateId("f"),
				category: "permissions",
				severity: "high",
				title: "Shell command execution capability",
				description: `Found ${shellHits.length} shell execution pattern(s). The tool can execute arbitrary system commands.`,
				evidenceIds,
				recommendation:
					"Implement allowlisting for shell commands. Require explicit user approval before execution.",
			})
		}

		if (fsHits.length > 10) {
			const evidenceIds = ctx.evidence
				.filter((e) => e.metadata?.permissionType === "filesystem")
				.slice(0, 10)
				.map((e) => e.id)
			ctx.addFinding({
				id: generateId("f"),
				category: "permissions",
				severity: "medium",
				title: "Broad filesystem access",
				description: `Found ${fsHits.length} filesystem operation(s). The tool has extensive read/write access to the local filesystem.`,
				evidenceIds,
				recommendation:
					"Restrict filesystem access to the project directory. Implement a permission sandbox.",
			})
		}

		if (sensitivePathHits.length > 0) {
			const evidenceIds = ctx.evidence
				.filter((e) => e.metadata?.permissionType === "sensitive_path")
				.map((e) => e.id)
			ctx.addFinding({
				id: generateId("f"),
				category: "permissions",
				severity: "high",
				title: "Sensitive file path access",
				description: `Found ${sensitivePathHits.length} reference(s) to sensitive file paths (.env, SSH keys, credentials, etc.).`,
				evidenceIds,
				recommendation:
					"Never access sensitive paths without explicit user consent. Block access to credential files by default.",
			})
		}

		if (networkHits.length > 0) {
			const evidenceIds = ctx.evidence
				.filter((e) => e.metadata?.permissionType === "network")
				.map((e) => e.id)
			ctx.addFinding({
				id: generateId("f"),
				category: "permissions",
				severity: "medium",
				title: "Network server/connection capability",
				description: `Found ${networkHits.length} raw network operation(s) (TCP/TLS servers, WebSockets). The tool can establish arbitrary network connections.`,
				evidenceIds,
				recommendation: "Document all network capabilities. Limit to necessary connections only.",
			})
		}

		if (elevatedHits.length > 0) {
			ctx.addFinding({
				id: generateId("f"),
				category: "permissions",
				severity: "critical",
				title: "Elevated privilege patterns detected",
				description: `Found ${elevatedHits.length} pattern(s) suggesting elevated/root privilege usage (sudo, setuid, etc.).`,
				evidenceIds: ctx
					.getEvidenceByType("permission_request")
					.slice(0, 5)
					.map((e) => e.id),
				recommendation:
					"AI tools should never require or use elevated privileges. Follow principle of least privilege.",
			})
		}
	}
}
