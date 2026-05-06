#!/usr/bin/env node
import { findKBRoot } from "@claws-shield/core"
// Thin wrapper for querying the intel database from the OpenClaw skill
import { searchKB } from "@claws-shield/intel"

const query = process.argv.slice(2).join(" ")
if (!query) {
	console.error("Usage: query-intel.mjs <query>")
	process.exit(1)
}

const kbRoot = findKBRoot()
const results = searchKB(kbRoot, query)
console.log(JSON.stringify(results, null, 2))
