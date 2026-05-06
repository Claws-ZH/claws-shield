import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { extname, join } from "node:path"
import type { TargetInfo } from "../types/index.js"

const TARGET_EXTENSIONS = new Set([".ts", ".js", ".jsx", ".tsx", ".json", ".md", ".mjs", ".cjs"])

function walkDir(dir: string, files: string[] = []): string[] {
	const entries = readdirSync(dir, { withFileTypes: true })
	for (const entry of entries) {
		const fullPath = join(dir, entry.name)
		if (entry.isDirectory()) {
			if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
				continue
			}
			walkDir(fullPath, files)
		} else if (entry.isFile() && TARGET_EXTENSIONS.has(extname(entry.name))) {
			files.push(fullPath)
		}
	}
	return files
}

function countLines(filePath: string): number {
	try {
		const content = readFileSync(filePath, "utf-8")
		return content.split("\n").length
	} catch {
		return 0
	}
}

function detectToolInfo(targetPath: string): { name?: string; version?: string } {
	const pkgPath = join(targetPath, "package.json")
	if (!existsSync(pkgPath)) return {}
	try {
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
		return {
			name: pkg.name ?? pkg.productName,
			version: pkg.version,
		}
	} catch {
		return {}
	}
}

export function loadTarget(targetPath: string): TargetInfo {
	if (!existsSync(targetPath)) {
		throw new Error(`Target path does not exist: ${targetPath}`)
	}

	const stat = statSync(targetPath)
	const files = stat.isDirectory() ? walkDir(targetPath) : [targetPath]

	let totalLines = 0
	for (const file of files) {
		totalLines += countLines(file)
	}

	const toolInfo = stat.isDirectory() ? detectToolInfo(targetPath) : {}

	return {
		path: targetPath,
		files,
		totalLines,
		toolName: toolInfo.name,
		toolVersion: toolInfo.version,
	}
}
