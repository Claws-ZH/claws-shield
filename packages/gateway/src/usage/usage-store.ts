export interface UsageEntry {
	id: string
	timestamp: string
	provider: string
	model: string
	promptTokens: number
	completionTokens: number
	totalTokens: number
	cost: number
	latency: number
	success: boolean
}

export interface UsageAggregation {
	totalRequests: number
	totalTokens: number
	totalCost: number
	avgLatency: number
	byProvider: Record<string, { requests: number; tokens: number; cost: number }>
	byModel: Record<string, { requests: number; tokens: number; cost: number }>
}

export interface BudgetAlert {
	threshold: number
	period: "daily" | "weekly" | "monthly"
	callback: (current: number, threshold: number) => void
}

export class UsageStore {
	private entries: UsageEntry[] = []
	private budgetAlerts: BudgetAlert[] = []

	/** Record a usage entry. */
	record(entry: Omit<UsageEntry, "id" | "timestamp">): UsageEntry {
		const full: UsageEntry = {
			...entry,
			id: crypto.randomUUID(),
			timestamp: new Date().toISOString(),
		}
		this.entries.push(full)
		this.checkBudgetAlerts()
		return full
	}

	/** Get all entries, optionally filtered by time range. */
	getEntries(since?: Date, until?: Date): UsageEntry[] {
		return this.entries.filter((e) => {
			const ts = new Date(e.timestamp)
			if (since && ts < since) return false
			if (until && ts > until) return false
			return true
		})
	}

	/** Get aggregate stats for a time period. */
	aggregate(since?: Date, until?: Date): UsageAggregation {
		const entries = this.getEntries(since, until)
		const byProvider: Record<string, { requests: number; tokens: number; cost: number }> = {}
		const byModel: Record<string, { requests: number; tokens: number; cost: number }> = {}
		let totalTokens = 0
		let totalCost = 0
		let totalLatency = 0

		for (const e of entries) {
			totalTokens += e.totalTokens
			totalCost += e.cost
			totalLatency += e.latency

			if (!byProvider[e.provider]) {
				byProvider[e.provider] = { requests: 0, tokens: 0, cost: 0 }
			}
			byProvider[e.provider].requests++
			byProvider[e.provider].tokens += e.totalTokens
			byProvider[e.provider].cost += e.cost

			if (!byModel[e.model]) {
				byModel[e.model] = { requests: 0, tokens: 0, cost: 0 }
			}
			byModel[e.model].requests++
			byModel[e.model].tokens += e.totalTokens
			byModel[e.model].cost += e.cost
		}

		return {
			totalRequests: entries.length,
			totalTokens,
			totalCost,
			avgLatency: entries.length > 0 ? totalLatency / entries.length : 0,
			byProvider,
			byModel,
		}
	}

	/** Get daily aggregation. */
	daily(): UsageAggregation {
		const now = new Date()
		const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
		return this.aggregate(startOfDay)
	}

	/** Get weekly aggregation (last 7 days). */
	weekly(): UsageAggregation {
		const since = new Date()
		since.setDate(since.getDate() - 7)
		return this.aggregate(since)
	}

	/** Get monthly aggregation (last 30 days). */
	monthly(): UsageAggregation {
		const since = new Date()
		since.setDate(since.getDate() - 30)
		return this.aggregate(since)
	}

	/** Set a budget alert. */
	addBudgetAlert(alert: BudgetAlert): void {
		this.budgetAlerts.push(alert)
	}

	/** Remove all budget alerts. */
	clearBudgetAlerts(): void {
		this.budgetAlerts = []
	}

	/** Export all entries as JSON (for file persistence). */
	toJSON(): string {
		return JSON.stringify(this.entries, null, 2)
	}

	/** Import entries from JSON. */
	fromJSON(json: string): void {
		const parsed = JSON.parse(json) as UsageEntry[]
		this.entries = parsed
	}

	/** Clear all stored entries. */
	clear(): void {
		this.entries = []
	}

	private checkBudgetAlerts(): void {
		for (const alert of this.budgetAlerts) {
			let agg: UsageAggregation
			switch (alert.period) {
				case "daily":
					agg = this.daily()
					break
				case "weekly":
					agg = this.weekly()
					break
				case "monthly":
					agg = this.monthly()
					break
			}
			if (agg.totalCost >= alert.threshold) {
				alert.callback(agg.totalCost, alert.threshold)
			}
		}
	}
}
