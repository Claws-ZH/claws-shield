import { join } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import {
	loadIntelDatabase,
	lookupCodename,
	queryFlags,
	queryTools,
	searchAll,
} from "../src/index.js"
import type { IntelDatabase } from "../src/index.js"

const KB_ROOT = join(__dirname, "..", "..", "..", "knowledge-base")

describe("Intel Query Engine", () => {
	let db: IntelDatabase

	beforeAll(() => {
		db = loadIntelDatabase(KB_ROOT)
	})

	describe("loadIntelDatabase", () => {
		it("loads all datasets", () => {
			expect(db.featureFlags.length).toBeGreaterThan(0)
			expect(db.killswitches.length).toBeGreaterThan(0)
			expect(db.codenames.length).toBeGreaterThan(0)
			expect(db.unreleasedTools.length).toBeGreaterThan(0)
			expect(db.telemetryEndpoints.length).toBeGreaterThan(0)
		})
	})

	describe("searchAll", () => {
		it("finds feature flags by name", () => {
			const results = searchAll(db, "frond_boric")
			expect(results.length).toBeGreaterThan(0)
			expect(results[0].type).toBe("flag")
		})

		it("finds codenames by name", () => {
			const results = searchAll(db, "capybara")
			expect(results.some((r) => r.type === "codename")).toBe(true)
		})

		it("finds tools by name", () => {
			const results = searchAll(db, "WebBrowser")
			expect(results.some((r) => r.type === "tool")).toBe(true)
		})

		it("finds endpoints by host", () => {
			const results = searchAll(db, "datadog")
			expect(results.some((r) => r.type === "endpoint")).toBe(true)
		})

		it("returns empty for unknown queries", () => {
			const results = searchAll(db, "xyznonexistent123")
			expect(results.length).toBe(0)
		})
	})

	describe("queryFlags", () => {
		it("filters by category", () => {
			const results = queryFlags(db, { category: "killswitch" })
			expect(results.length).toBeGreaterThan(0)
			results.forEach((f: any) => expect(f.category).toBe("killswitch"))
		})

		it("filters by risk level", () => {
			const results = queryFlags(db, { riskLevel: "critical" })
			results.forEach((f: any) => expect(f.riskLevel).toBe("critical"))
		})
	})

	describe("lookupCodename", () => {
		it("finds Capybara", () => {
			const result = lookupCodename(db, "Capybara")
			expect(result).not.toBeNull()
			expect(result?.mapsTo).toContain("Sonnet")
		})

		it("returns null for unknown", () => {
			expect(lookupCodename(db, "nonexistent")).toBeNull()
		})
	})

	describe("queryTools", () => {
		it("finds KAIROS tools", () => {
			const results = queryTools(db, { capabilityArea: "autonomous_agent" })
			expect(results.length).toBeGreaterThan(0)
		})

		it("finds tools by feature flag", () => {
			const results = queryTools(db, { featureFlag: "KAIROS" })
			expect(results.length).toBeGreaterThan(0)
		})
	})
})
