import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const KB_ROOT = join(import.meta.dirname, "..", "knowledge-base")

function validate() {
	const manifestPath = join(KB_ROOT, "manifest.json")
	if (!existsSync(manifestPath)) {
		console.error("ERROR: manifest.json not found at", manifestPath)
		process.exit(1)
	}

	const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"))
	let errors = 0

	for (const [dataset, _version] of Object.entries(manifest.datasets)) {
		const datasetPath = join(KB_ROOT, dataset)
		if (!existsSync(datasetPath)) {
			console.error(`MISSING: ${dataset}`)
			errors++
		} else {
			try {
				JSON.parse(readFileSync(datasetPath, "utf-8"))
				console.log(`  OK: ${dataset}`)
			} catch (e) {
				console.error(`INVALID JSON: ${dataset}`)
				errors++
			}
		}
	}

	if (errors > 0) {
		console.error(`\n${errors} KB validation error(s)`)
		process.exit(1)
	}

	console.log("\nKB validation passed")
}

validate()
