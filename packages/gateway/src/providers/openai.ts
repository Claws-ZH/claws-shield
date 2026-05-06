import { calculateCost } from "../router/cost-model.js"
import type { ProviderConfig, RouteRequest, RouteResponse } from "../types.js"
import type { Provider } from "./base.js"

const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "o1", "o1-mini"] as const

export class OpenAIProvider implements Provider {
	readonly name = "openai"
	private readonly apiKey: string | undefined
	private readonly baseUrl: string
	private readonly timeout: number
	private readonly maxRetries: number

	constructor(config?: Partial<ProviderConfig>) {
		this.apiKey = config?.apiKey ?? process.env.OPENAI_API_KEY
		this.baseUrl = config?.baseUrl ?? "https://api.openai.com"
		this.timeout = config?.timeout ?? 30_000
		this.maxRetries = config?.maxRetries ?? 2
	}

	isAvailable(): boolean {
		return !!this.apiKey
	}

	listModels(): string[] {
		return [...OPENAI_MODELS]
	}

	estimateCost(model: string, promptTokens: number, completionTokens: number): number {
		return calculateCost(this.name, model, promptTokens, completionTokens)
	}

	async complete(req: RouteRequest): Promise<RouteResponse> {
		if (!this.apiKey) {
			throw new Error("OpenAI API key not configured")
		}

		const model = req.model ?? "gpt-4o"
		const start = Date.now()
		let lastError: Error | null = null

		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			try {
				const controller = new AbortController()
				const timeoutId = setTimeout(() => controller.abort(), this.timeout)

				const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify({
						model,
						messages: req.messages.map((m) => ({
							role: m.role,
							content: m.content,
						})),
						max_tokens: req.maxTokens ?? 4096,
						temperature: req.temperature,
					}),
					signal: controller.signal,
				})

				clearTimeout(timeoutId)

				if (response.status === 429) {
					const retryAfter = response.headers.get("retry-after")
					const waitMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 1000 * (attempt + 1)
					await sleep(waitMs)
					lastError = new Error("Rate limited (429) by OpenAI")
					continue
				}

				if (!response.ok) {
					const body = await response.text()
					throw new Error(`OpenAI API error ${response.status}: ${body}`)
				}

				const data = (await response.json()) as OpenAIResponse
				const latency = Date.now() - start
				const content = data.choices?.[0]?.message?.content ?? ""
				const promptTokens = data.usage?.prompt_tokens ?? 0
				const completionTokens = data.usage?.completion_tokens ?? 0

				return {
					id: data.id ?? crypto.randomUUID(),
					model,
					provider: this.name,
					content,
					usage: {
						promptTokens,
						completionTokens,
						totalTokens: promptTokens + completionTokens,
					},
					latency,
					cost: this.estimateCost(model, promptTokens, completionTokens),
				}
			} catch (err) {
				lastError = err instanceof Error ? err : new Error(String(err))
				if (attempt < this.maxRetries) {
					await sleep(1000 * (attempt + 1))
				}
			}
		}

		throw lastError ?? new Error("OpenAI request failed after retries")
	}
}

interface OpenAIResponse {
	id: string
	object: string
	choices: Array<{
		index: number
		message: { role: string; content: string }
		finish_reason: string
	}>
	usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
