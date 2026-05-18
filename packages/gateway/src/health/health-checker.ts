/**
 * Simple circuit breaker for provider health tracking.
 *
 * If a provider has > `failureThreshold` consecutive failures,
 * it is marked unhealthy for `cooldownMs` milliseconds.
 */
export class HealthChecker {
	private failures = new Map<string, number>()
	private lastFailure = new Map<string, number>()
	private unhealthySince = new Map<string, number>()

	private readonly failureThreshold: number
	private readonly cooldownMs: number

	constructor(failureThreshold = 3, cooldownMs = 60_000) {
		this.failureThreshold = failureThreshold
		this.cooldownMs = cooldownMs
	}

	/** Check if a provider is healthy (circuit closed or cooldown expired). */
	isHealthy(provider: string): boolean {
		const since = this.unhealthySince.get(provider)
		if (since === undefined) return true

		// Check if cooldown has expired
		if (Date.now() - since >= this.cooldownMs) {
			// Reset — allow half-open state
			this.unhealthySince.delete(provider)
			this.failures.set(provider, 0)
			return true
		}

		return false
	}

	/** Record a successful call — resets the failure counter. */
	recordSuccess(provider: string): void {
		this.failures.set(provider, 0)
		this.unhealthySince.delete(provider)
	}

	/** Record a failed call — increments the counter and may trip the breaker. */
	recordFailure(provider: string): void {
		const count = (this.failures.get(provider) ?? 0) + 1
		this.failures.set(provider, count)
		this.lastFailure.set(provider, Date.now())

		if (count >= this.failureThreshold) {
			this.unhealthySince.set(provider, Date.now())
		}
	}

	/** Get the current failure count for a provider. */
	getFailureCount(provider: string): number {
		return this.failures.get(provider) ?? 0
	}

	/** Get health status summary for all tracked providers. */
	getStatus(): Array<{ provider: string; healthy: boolean; failures: number }> {
		const providers = new Set([...this.failures.keys(), ...this.unhealthySince.keys()])
		return [...providers].map((provider) => ({
			provider,
			healthy: this.isHealthy(provider),
			failures: this.getFailureCount(provider),
		}))
	}

	/** Reset all health state. */
	reset(): void {
		this.failures.clear()
		this.lastFailure.clear()
		this.unhealthySince.clear()
	}
}
