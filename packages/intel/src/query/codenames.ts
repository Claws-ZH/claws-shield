import type { IntelDatabase } from "../loader/load-kb.js"

export function queryCodenames(
	db: IntelDatabase,
	opts?: { codename?: string; status?: string; kind?: string },
) {
	let results = db.codenames
	if (opts?.codename) {
		const q = opts.codename.toLowerCase()
		results = results.filter((c: any) => c.codename.toLowerCase().includes(q))
	}
	if (opts?.status) {
		results = results.filter((c: any) => c.status === opts.status)
	}
	if (opts?.kind) {
		results = results.filter((c: any) => c.kind === opts.kind)
	}
	return results
}

export function lookupCodename(db: IntelDatabase, name: string) {
	return db.codenames.find((c: any) => c.codename.toLowerCase() === name.toLowerCase()) ?? null
}
