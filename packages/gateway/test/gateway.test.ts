import { beforeEach, describe, expect, it, vi } from "vitest"

import { HealthChecker } from "../src/health/health-checker.js"
import type { Provider } from "../src/providers/base.js"
import { ProviderRegistry } from "../src/providers/registry.js"
import { calculateCost, getModelCost, getQualityScore } from "../src/router/cost-model.js"
import { Router } from "../src/router/router.js"
import type { RouteRequest, RouteResponse } from "../src/types.js"
import { UsageStore } from "../src/usage/usage-store.js"

// ---------------------------------------------------------------------------
// Helper: create a mock provider
// ---------------------------------------------------------------------------
function createMockProvider(
	name: string,
	models: string[],
	available = true,
	completeFn?: (req: RouteRequest) => Promise<RouteResponse>,
): Provider {
	return {
		name,
		isAvailable: () => available,
		listModels: () => models,
		complete:
			completeFn ??
			(async (req: RouteRequest): Promise<RouteResponse> => ({
				id: `resp-${name}-${Date.now()}`,
				model: req.model ?? models[0],
				provider: name,
				content: `Response from ${name}`,
				usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
				latency: 200,
				cost: 0.001,
			})),
		estimateCost: (_model: string, promptTokens: number, completionTokens: number) => {
			const cost = getModelCost(name, models[0])
			return (promptTokens * cost.input + completionTokens * cost.output) / 1_000_000
		},
	}
}

// ---------------------------------------------------------------------------
// 1. ProviderRegistry
// ---------------------------------------------------------------------------
describe("ProviderRegistry", () => {
	it("registers providers and looks up by name", () => {
		const registry = new ProviderRegistry()
		const mock = createMockProvider("test-provider", ["test-model-1"])
		registry.register(mock)

		const found = registry.getProvider("test-provider")
		expect(found).toBeDefined()
		expect(found?.name).toBe("test-provider")
	})

	it("looks up provider by model", () => {
		const registry = new ProviderRegistry()
		const mock = createMockProvider("test-provider", ["model-a", "model-b"])
		registry.register(mock)

		const provider = registry.getProviderForModel("model-a")
		expect(provider).toBeDefined()
		expect(provider?.name).toBe("test-provider")

		const providerB = registry.getProviderForModel("model-b")
		expect(providerB).toBeDefined()
		expect(providerB?.name).toBe("test-provider")
	})

	it("returns undefined for unknown model", () => {
		const registry = new ProviderRegistry()
		expect(registry.getProviderForModel("nonexistent-model-xyz")).toBeUndefined()
	})

	it("lists all registered providers", () => {
		const registry = new ProviderRegistry()
		// Default providers are registered in constructor
		const providers = registry.listProviders()
		expect(providers.length).toBeGreaterThanOrEqual(4) // anthropic, openai, gemini, ollama
	})

	it("lists all models across providers", () => {
		const registry = new ProviderRegistry()
		const allModels = registry.listAllModels()
		expect(allModels.length).toBeGreaterThan(0)
		// Each entry should have model and provider fields
		for (const entry of allModels) {
			expect(entry.model).toBeTruthy()
			expect(entry.provider).toBeTruthy()
		}
	})
})

// ---------------------------------------------------------------------------
// 2. Cost model
// ---------------------------------------------------------------------------
describe("Cost model", () => {
	it("returns correct pricing for known models", () => {
		const opusCost = getModelCost("anthropic", "claude-opus-4-6")
		expect(opusCost.input).toBe(15.0)
		expect(opusCost.output).toBe(75.0)

		const gpt4oCost = getModelCost("openai", "gpt-4o")
		expect(gpt4oCost.input).toBe(2.5)
		expect(gpt4oCost.output).toBe(10.0)

		const flashCost = getModelCost("gemini", "gemini-2.0-flash")
		expect(flashCost.input).toBe(0.1)
		expect(flashCost.output).toBe(0.4)
	})

	it("returns zero cost for unknown models", () => {
		const unknown = getModelCost("unknown-provider", "unknown-model")
		expect(unknown.input).toBe(0)
		expect(unknown.output).toBe(0)
	})

	it("calculates actual cost correctly", () => {
		// claude-opus-4-6: input=$15/1M, output=$75/1M
		// 1000 prompt tokens + 500 completion tokens
		const cost = calculateCost("anthropic", "claude-opus-4-6", 1000, 500)
		const expected = (1000 * 15.0 + 500 * 75.0) / 1_000_000
		expect(cost).toBeCloseTo(expected, 6)
	})

	it("returns quality scores for known models", () => {
		expect(getQualityScore("claude-opus-4-6")).toBe(95)
		expect(getQualityScore("gpt-4o-mini")).toBe(65)
		expect(getQualityScore("gemini-2.0-flash")).toBe(60)
	})

	it("returns default quality score for unknown models", () => {
		expect(getQualityScore("unknown-model")).toBe(50)
	})
})

// ---------------------------------------------------------------------------
// 3. Health checker
// ---------------------------------------------------------------------------
describe("HealthChecker", () => {
	let hc: HealthChecker

	beforeEach(() => {
		// threshold=3 failures, cooldown=100ms (short for testing)
		hc = new HealthChecker(3, 100)
	})

	it("starts healthy", () => {
		expect(hc.isHealthy("test-provider")).toBe(true)
	})

	it("stays healthy below failure threshold", () => {
		hc.recordFailure("test-provider")
		hc.recordFailure("test-provider")
		expect(hc.isHealthy("test-provider")).toBe(true)
		expect(hc.getFailureCount("test-provider")).toBe(2)
	})

	it("marks unhealthy after reaching failure threshold", () => {
		hc.recordFailure("test-provider")
		hc.recordFailure("test-provider")
		hc.recordFailure("test-provider")
		expect(hc.isHealthy("test-provider")).toBe(false)
		expect(hc.getFailureCount("test-provider")).toBe(3)
	})

	it("recovers after cooldown period", async () => {
		hc.recordFailure("test-provider")
		hc.recordFailure("test-provider")
		hc.recordFailure("test-provider")
		expect(hc.isHealthy("test-provider")).toBe(false)

		// Wait for cooldown to expire
		await new Promise((r) => setTimeout(r, 150))
		expect(hc.isHealthy("test-provider")).toBe(true)
	})

	it("resets on success", () => {
		hc.recordFailure("test-provider")
		hc.recordFailure("test-provider")
		hc.recordSuccess("test-provider")
		expect(hc.getFailureCount("test-provider")).toBe(0)
		expect(hc.isHealthy("test-provider")).toBe(true)
	})

	it("getStatus returns all tracked providers", () => {
		hc.recordFailure("provider-a")
		hc.recordFailure("provider-b")
		hc.recordFailure("provider-b")
		hc.recordFailure("provider-b")

		const status = hc.getStatus()
		expect(status.length).toBe(2)

		const a = status.find((s) => s.provider === "provider-a")
		expect(a?.healthy).toBe(true)
		expect(a?.failures).toBe(1)

		const b = status.find((s) => s.provider === "provider-b")
		expect(b?.healthy).toBe(false)
		expect(b?.failures).toBe(3)
	})

	it("reset clears all state", () => {
		hc.recordFailure("test-provider")
		hc.recordFailure("test-provider")
		hc.recordFailure("test-provider")
		hc.reset()
		expect(hc.isHealthy("test-provider")).toBe(true)
		expect(hc.getFailureCount("test-provider")).toBe(0)
		expect(hc.getStatus()).toHaveLength(0)
	})
})

// ---------------------------------------------------------------------------
// 4. Usage store
// ---------------------------------------------------------------------------
describe("UsageStore", () => {
	let store: UsageStore

	beforeEach(() => {
		store = new UsageStore()
	})

	it("records entries and assigns id and timestamp", () => {
		const entry = store.record({
			provider: "anthropic",
			model: "claude-opus-4-6",
			promptTokens: 1000,
			completionTokens: 500,
			totalTokens: 1500,
			cost: 0.05,
			latency: 200,
			success: true,
		})

		expect(entry.id).toBeTruthy()
		expect(entry.timestamp).toBeTruthy()
		expect(entry.provider).toBe("anthropic")
	})

	it("getEntries returns all stored entries", () => {
		store.record({
			provider: "anthropic",
			model: "claude-opus-4-6",
			promptTokens: 100,
			completionTokens: 50,
			totalTokens: 150,
			cost: 0.01,
			latency: 100,
			success: true,
		})
		store.record({
			provider: "openai",
			model: "gpt-4o",
			promptTokens: 200,
			completionTokens: 100,
			totalTokens: 300,
			cost: 0.02,
			latency: 150,
			success: true,
		})

		const entries = store.getEntries()
		expect(entries).toHaveLength(2)
	})

	it("aggregates by period correctly", () => {
		store.record({
			provider: "anthropic",
			model: "claude-opus-4-6",
			promptTokens: 1000,
			completionTokens: 500,
			totalTokens: 1500,
			cost: 0.05,
			latency: 200,
			success: true,
		})
		store.record({
			provider: "anthropic",
			model: "claude-opus-4-6",
			promptTokens: 2000,
			completionTokens: 1000,
			totalTokens: 3000,
			cost: 0.1,
			latency: 300,
			success: true,
		})
		store.record({
			provider: "openai",
			model: "gpt-4o",
			promptTokens: 500,
			completionTokens: 250,
			totalTokens: 750,
			cost: 0.03,
			latency: 100,
			success: true,
		})

		const agg = store.aggregate()
		expect(agg.totalRequests).toBe(3)
		expect(agg.totalTokens).toBe(5250)
		expect(agg.totalCost).toBeCloseTo(0.18, 2)
		expect(agg.avgLatency).toBeCloseTo(200, 0)

		// By provider
		expect(agg.byProvider.anthropic.requests).toBe(2)
		expect(agg.byProvider.anthropic.tokens).toBe(4500)
		expect(agg.byProvider.openai.requests).toBe(1)

		// By model
		expect(agg.byModel["claude-opus-4-6"].requests).toBe(2)
		expect(agg.byModel["gpt-4o"].requests).toBe(1)
	})

	it("daily aggregation includes today's entries", () => {
		store.record({
			provider: "anthropic",
			model: "claude-opus-4-6",
			promptTokens: 100,
			completionTokens: 50,
			totalTokens: 150,
			cost: 0.01,
			latency: 100,
			success: true,
		})

		const daily = store.daily()
		expect(daily.totalRequests).toBe(1)
	})

	it("budget alert triggers when threshold is exceeded", () => {
		const alertFn = vi.fn()
		store.addBudgetAlert({ threshold: 0.05, period: "daily", callback: alertFn })

		store.record({
			provider: "anthropic",
			model: "claude-opus-4-6",
			promptTokens: 1000,
			completionTokens: 500,
			totalTokens: 1500,
			cost: 0.06,
			latency: 200,
			success: true,
		})

		expect(alertFn).toHaveBeenCalledWith(0.06, 0.05)
	})

	it("toJSON and fromJSON round-trip", () => {
		store.record({
			provider: "anthropic",
			model: "claude-opus-4-6",
			promptTokens: 100,
			completionTokens: 50,
			totalTokens: 150,
			cost: 0.01,
			latency: 100,
			success: true,
		})

		const json = store.toJSON()
		const store2 = new UsageStore()
		store2.fromJSON(json)

		expect(store2.getEntries()).toHaveLength(1)
		expect(store2.getEntries()[0].provider).toBe("anthropic")
	})

	it("clear removes all entries", () => {
		store.record({
			provider: "anthropic",
			model: "x",
			promptTokens: 1,
			completionTokens: 1,
			totalTokens: 2,
			cost: 0,
			latency: 0,
			success: true,
		})
		store.clear()
		expect(store.getEntries()).toHaveLength(0)
	})
})

// ---------------------------------------------------------------------------
// 5. Router
// ---------------------------------------------------------------------------
describe("Router", () => {
	function buildRouter(providers: Provider[], hc?: HealthChecker) {
		const registry = new ProviderRegistry()
		// Clear defaults by registering our mocks which will overwrite
		for (const p of providers) {
			registry.register(p)
		}
		const healthChecker = hc ?? new HealthChecker()
		return new Router({ registry, healthChecker })
	}

	const baseReq: RouteRequest = {
		messages: [{ role: "user", content: "Hello" }],
		maxTokens: 100,
	}

	it("routes to a specific model when requested", async () => {
		const provider = createMockProvider("mock-provider", ["mock-model"])
		const router = buildRouter([provider])

		const response = await router.route({ ...baseReq, model: "mock-model" })
		expect(response.provider).toBe("mock-provider")
		expect(response.model).toBe("mock-model")
	})

	it("falls back through chain on failure", async () => {
		let callCount = 0
		const failProvider = createMockProvider("fail-provider", ["fail-model"], true, async () => {
			callCount++
			throw new Error("Provider unavailable")
		})
		const goodProvider = createMockProvider("good-provider", ["good-model"])
		const router = buildRouter([failProvider, goodProvider])

		const response = await router.route({ ...baseReq, model: "fail-model" }, "balanced", [
			"good-model",
		])
		expect(response.provider).toBe("good-provider")
		expect(callCount).toBe(1)
	})

	it("throws when all providers in chain fail", async () => {
		const failProvider = createMockProvider("fail-provider", ["fail-model"], true, async () => {
			throw new Error("Provider unavailable")
		})
		const router = buildRouter([failProvider])

		await expect(router.route({ ...baseReq, model: "fail-model" })).rejects.toThrow(
			"All providers in chain failed",
		)
	})

	it("routes by cheapest strategy", async () => {
		// Create two available providers with known pricing
		const cheapProvider = createMockProvider("gemini", ["gemini-2.0-flash"], true, async (req) => ({
			id: "resp-cheap",
			model: req.model ?? "gemini-2.0-flash",
			provider: "gemini",
			content: "Cheap response",
			usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
			latency: 100,
			cost: 0.0001,
		}))

		const expensiveProvider = createMockProvider(
			"anthropic",
			["claude-opus-4-6"],
			true,
			async (req) => ({
				id: "resp-expensive",
				model: req.model ?? "claude-opus-4-6",
				provider: "anthropic",
				content: "Expensive response",
				usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
				latency: 500,
				cost: 0.05,
			}),
		)

		const router = buildRouter([cheapProvider, expensiveProvider])
		const response = await router.route(baseReq, "cheapest")

		// Cheapest strategy should pick gemini-2.0-flash (input=0.10) over claude-opus-4-6 (input=15.0)
		expect(response.provider).toBe("gemini")
	})

	it("routes by best_quality strategy", async () => {
		const lowQProvider = createMockProvider("gemini", ["gemini-2.0-flash"], true, async (req) => ({
			id: "resp-low",
			model: req.model ?? "gemini-2.0-flash",
			provider: "gemini",
			content: "Low quality response",
			usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
			latency: 100,
			cost: 0.0001,
		}))

		const highQProvider = createMockProvider(
			"anthropic",
			["claude-opus-4-6"],
			true,
			async (req) => ({
				id: "resp-high",
				model: req.model ?? "claude-opus-4-6",
				provider: "anthropic",
				content: "High quality response",
				usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
				latency: 500,
				cost: 0.05,
			}),
		)

		const router = buildRouter([lowQProvider, highQProvider])
		const response = await router.route(baseReq, "best_quality")

		// best_quality should pick claude-opus-4-6 (quality=95) over gemini-2.0-flash (quality=60)
		expect(response.provider).toBe("anthropic")
	})

	it("skips unhealthy providers", async () => {
		const hc = new HealthChecker(1, 60_000) // threshold=1 for easy triggering

		const unhealthyProvider = createMockProvider("anthropic", ["claude-opus-4-6"], true)
		const healthyProvider = createMockProvider(
			"gemini",
			["gemini-2.0-flash"],
			true,
			async (req) => ({
				id: "resp-healthy",
				model: req.model ?? "gemini-2.0-flash",
				provider: "gemini",
				content: "Healthy response",
				usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
				latency: 100,
				cost: 0.0001,
			}),
		)

		const router = buildRouter([unhealthyProvider, healthyProvider], hc)

		// Mark anthropic as unhealthy
		hc.recordFailure("anthropic")
		expect(hc.isHealthy("anthropic")).toBe(false)

		const response = await router.route(baseReq, "best_quality")
		// Should skip anthropic and use gemini
		expect(response.provider).toBe("gemini")
	})

	it("throws when no providers are available", async () => {
		const unavailable = createMockProvider("test", ["test-model"], false)
		const router = buildRouter([unavailable])

		await expect(router.route(baseReq, "balanced")).rejects.toThrow(
			"No available providers/models to route to",
		)
	})
})
