#!/usr/bin/env node
import { Command } from "commander"
import { runAudit, formatJson, formatMarkdown, formatTerminal } from "@claws-shield/auditor"
import { scanSkill } from "@claws-shield/scanner"
import { loadIntelDatabase, searchAll, queryFlags, queryCodenames } from "@claws-shield/intel"
import { findKBRoot, scoreToGrade, gradeColor, RESET } from "@claws-shield/core"
import type { AuditReport, Grade, ReportFormat } from "@claws-shield/core"
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"

const program = new Command()

program
	.name("claws-shield")
	.description("The world's most powerful AI Agent audit & governance toolkit")
	.version("1.0.0")

// ── audit command ──────────────────────────────────────────────
program
	.command("audit <target>")
	.description("Audit an AI coding tool for telemetry, remote control, permissions, and privacy")
	.option("-f, --format <format>", "Output format: terminal, json, markdown", "terminal")
	.option("-o, --out <path>", "Write report to file")
	.option("--fail-below <grade>", "Exit with code 10 if grade is below threshold")
	.option("--score-only", "Only output the score and grade")
	.action(async (target: string, opts: { format: string; out?: string; failBelow?: string; scoreOnly?: boolean }) => {
		try {
			const targetPath = resolve(target)
			const report = await runAudit(targetPath)

			if (opts.scoreOnly) {
				const color = gradeColor(report.overallGrade)
				console.log(`${color}${report.overallGrade}${RESET} (${report.overallScore}/100)`)
			} else {
				const output = formatReport(report, opts.format as ReportFormat)
				if (opts.out) {
					writeFileSync(opts.out, output)
					console.log(`Report written to ${opts.out}`)
				} else {
					console.log(output)
				}
			}

			if (opts.failBelow) {
				const grades: Grade[] = ["A", "B", "C", "D", "F"]
				const thresholdIdx = grades.indexOf(opts.failBelow.toUpperCase() as Grade)
				const actualIdx = grades.indexOf(report.overallGrade)
				if (actualIdx > thresholdIdx) process.exit(10)
			}
		} catch (err) {
			console.error("Audit failed:", (err as Error).message)
			process.exit(1)
		}
	})

// ── scan command ───────────────────────────────────────────────
program
	.command("scan <skillPath>")
	.description("Scan an OpenClaw skill for security issues")
	.option("-f, --format <format>", "Output format: terminal, json", "terminal")
	.option("--fail-on <severity>", "Exit with code 20 if findings at or above severity")
	.action(async (skillPath: string, opts: { format: string; failOn?: string }) => {
		try {
			const result = await scanSkill(resolve(skillPath))

			if (opts.format === "json") {
				console.log(JSON.stringify(result, null, 2))
			} else {
				const color = gradeColor(result.securityGrade as Grade)
				console.log(`\n  Skill Security Scan`)
				console.log(`  Grade: ${color}${result.securityGrade}${RESET} (${result.securityScore}/100)`)
				console.log(`  Files scanned: ${result.metadata.filesScanned}`)
				console.log(`  Rules applied: ${result.metadata.rulesRun}`)
				console.log(`  Findings: ${result.findings.length}`)
				if (result.findings.length > 0) {
					console.log(`\n  Findings:`)
					for (const f of result.findings) {
						const sev = f.severity === "critical" ? "\x1b[31m" : f.severity === "high" ? "\x1b[33m" : "\x1b[36m"
						console.log(`    ${sev}[${f.severity}]${RESET} ${f.title}`)
						console.log(`      ${f.location?.file ?? "unknown"}:${f.location?.line ?? "?"} — ${f.description}`)
					}
				}
				console.log()
			}

			if (opts.failOn) {
				const sevOrder = ["info", "low", "medium", "high", "critical"]
				const threshold = sevOrder.indexOf(opts.failOn)
				const hasAbove = result.findings.some(f => sevOrder.indexOf(f.severity) >= threshold)
				if (hasAbove) process.exit(20)
			}
		} catch (err) {
			console.error("Scan failed:", (err as Error).message)
			process.exit(1)
		}
	})

// ── intel command ──────────────────────────────────────────────
program
	.command("intel <query>")
	.description("Query the intelligence database for codenames, flags, and features")
	.option("--flags", "Search only feature flags")
	.option("--codenames", "Search only model codenames")
	.option("--json", "Output as JSON")
	.action((query: string, opts: { flags?: boolean; codenames?: boolean; json?: boolean }) => {
		try {
			const db = loadIntelDatabase()

			if (opts.flags) {
				const results = queryFlags(db, { name: query })
				if (opts.json) {
					console.log(JSON.stringify(results, null, 2))
				} else {
					if (results.length === 0) {
						console.log("No matching flags found.")
					} else {
						console.log(`\n  Feature Flags matching "${query}" (${results.length} results):`)
						for (const r of results) {
							console.log(`    ${r.flag} — ${r.decodedPurpose || "unknown purpose"}`)
						}
						console.log()
					}
				}
				return
			}

			if (opts.codenames) {
				const results = queryCodenames(db, { codename: query })
				if (opts.json) {
					console.log(JSON.stringify(results, null, 2))
				} else {
					if (results.length === 0) {
						console.log("No matching codenames found.")
					} else {
						console.log(`\n  Codenames matching "${query}" (${results.length} results):`)
						for (const r of results) {
							console.log(`    ${r.codename} -> ${r.mapsTo || "unknown"} (${r.status || "unknown"})`)
						}
						console.log()
					}
				}
				return
			}

			const results = searchAll(db, query)
			if (opts.json) {
				console.log(JSON.stringify(results, null, 2))
			} else {
				if (results.length === 0) {
					console.log("No results found.")
				} else {
					console.log(`\n  Intel results for "${query}" (${results.length} results):`)
					for (const r of results) {
						console.log(`    [${r.type}] ${r.matchValue}`)
					}
					console.log()
				}
			}
		} catch (err) {
			console.error("Intel query failed:", (err as Error).message)
			process.exit(1)
		}
	})

// ── gateway command ────────────────────────────────────────────
program
	.command("gateway")
	.description("Start the multi-model routing gateway")
	.option("-p, --port <port>", "Server port", "8787")
	.action((opts: { port: string }) => {
		console.log(`\n  Claws-Shield Agent Gateway`)
		console.log(`  Starting on port ${opts.port}...`)
		console.log(`  Note: HTTP server not yet implemented in v1.0.0`)
		console.log(`  Use the gateway package programmatically:`)
		console.log(`    import { Router, ProviderRegistry } from "@claws-shield/gateway"\n`)
	})

// ── helpers ────────────────────────────────────────────────────
function formatReport(report: AuditReport, format: ReportFormat): string {
	switch (format) {
		case "json":
			return formatJson(report)
		case "markdown":
			return formatMarkdown(report)
		case "terminal":
		default:
			return formatTerminal(report)
	}
}

program.parse()
