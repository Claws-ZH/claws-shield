import { calculateCost } from "../router/cost-model.js"
import type { ProviderConfig, RouteRequest, RouteResponse } from "../types.js"
import type { Provider } from "./base.js"

const ANTHROPIC_MODELS = ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"] as const

export class AnthropicProvider implements Provider {
	readonly name = "anthropic"
	private readonly apiKey: string | undefined
	private readonly baseUrl: string
	private readonly timeout: number
	private readonly maxRetries: number

	constructor(config?: Partial<ProviderConfig>) {
		this.apiKey = config?.apiKey ?? process.env.ANTHROPIC_API_KEY
		this.baseUrl = config?.baseUrl ?? "https://api.anthropic.com"
		this.timeout = config?.timeout ?? 30_000
		this.maxRetries = config?.maxRetries ?? 2
	}

	isAvailable(): boolean {
		return !!this.apiKey
	}

	listModels(): string[] {
		return [...ANTHROPIC_MODELS]
	}

	estimateCost(model: string, promptTokens: number, completionTokens: number): number {
		return calculateCost(this.name, model, promptTokens, completionTokens)
	}

	async complete(req: RouteRequest): Promise<RouteResponse> {
		if (!this.apiKey) {
			throw new Error("Anthropic API key not configured")
		}

		const model = req.model ?? "claude-sonnet-4-6"
		const start = Date.now()
		let lastError: Error | null = null

		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			try {
				const controller = new AbortController()
				const timeoutId = setTimeout(() => controller.abort(), this.timeout)

				const response = await fetch(`${this.baseUrl}/v1/messages`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-api-key": this.apiKey,
						"anthropic-version": "2023-06-01",
					},
					body: JSON.stringify({
						model,
						max_tokens: req.maxTokens ?? 4096,
						temperature: req.temperature,
						messages: req.messages.map((m) => ({
							role: m.role === "system" ? "user" : m.role,
							content: m.content,
						})),
						...(req.messages.some((m) => m.role === "system")
							? { system: req.messages.find((m) => m.role === "system")?.content }
							: {}),
					}),
					signal: controller.signal,
				})

				clearTimeout(timeoutId)

				if (response.status === 429) {
					const retryAfter = response.headers.get("retry-after")
					const waitMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 1000 * (attempt + 1)
					await sleep(waitMs)
					lastError = new Error("Rate limited (429) by Anthropic")
					continue
				}

				if (!response.ok) {
					const body = await response.text()
					throw new Error(`Anthropic API error ${response.status}: ${body}`)
				}

				const data = (await response.json()) as AnthropicResponse
				const latency = Date.now() - start
				const content =
					data.content
						?.filter((b) => b.type === "text")
						.map((b) => b.text)
						.join("") ?? ""

				const promptTokens = data.usage?.input_tokens ?? 0
				const completionTokens = data.usage?.output_tokens ?? 0

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

		throw lastError ?? new Error("Anthropic request failed after retries")
	}
}

/** Anthropic Messages API response shape */
interface AnthropicResponse {
	id: string
	type: string
	role: string
	content: Array<{ type: string; text: string }>
	model: string
	usage: { input_tokens: number; output_tokens: number }
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
