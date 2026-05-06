import { calculateCost } from "../router/cost-model.js"
import type { ProviderConfig, RouteRequest, RouteResponse } from "../types.js"
import type { Provider } from "./base.js"

const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.5-pro"] as const

export class GeminiProvider implements Provider {
	readonly name = "gemini"
	private readonly apiKey: string | undefined
	private readonly baseUrl: string
	private readonly timeout: number
	private readonly maxRetries: number

	constructor(config?: Partial<ProviderConfig>) {
		this.apiKey = config?.apiKey ?? process.env.GEMINI_API_KEY
		this.baseUrl = config?.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta"
		this.timeout = config?.timeout ?? 30_000
		this.maxRetries = config?.maxRetries ?? 2
	}

	isAvailable(): boolean {
		return !!this.apiKey
	}

	listModels(): string[] {
		return [...GEMINI_MODELS]
	}

	estimateCost(model: string, promptTokens: number, completionTokens: number): number {
		return calculateCost(this.name, model, promptTokens, completionTokens)
	}

	async complete(req: RouteRequest): Promise<RouteResponse> {
		if (!this.apiKey) {
			throw new Error("Gemini API key not configured")
		}

		const model = req.model ?? "gemini-2.0-flash"
		const start = Date.now()
		let lastError: Error | null = null

		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			try {
				const controller = new AbortController()
				const timeoutId = setTimeout(() => controller.abort(), this.timeout)

				// Gemini uses a different message format — convert from OpenAI-style
				const contents = req.messages
					.filter((m) => m.role !== "system")
					.map((m) => ({
						role: m.role === "assistant" ? "model" : "user",
						parts: [{ text: m.content }],
					}))

				const systemInstruction = req.messages.find((m) => m.role === "system")

				const response = await fetch(
					`${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							contents,
							...(systemInstruction
								? {
										systemInstruction: {
											parts: [{ text: systemInstruction.content }],
										},
									}
								: {}),
							generationConfig: {
								maxOutputTokens: req.maxTokens ?? 4096,
								temperature: req.temperature,
							},
						}),
						signal: controller.signal,
					},
				)

				clearTimeout(timeoutId)

				if (response.status === 429) {
					const retryAfter = response.headers.get("retry-after")
					const waitMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 1000 * (attempt + 1)
					await sleep(waitMs)
					lastError = new Error("Rate limited (429) by Gemini")
					continue
				}

				if (!response.ok) {
					const body = await response.text()
					throw new Error(`Gemini API error ${response.status}: ${body}`)
				}

				const data = (await response.json()) as GeminiResponse
				const latency = Date.now() - start

				const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? ""

				const promptTokens = data.usageMetadata?.promptTokenCount ?? 0
				const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0

				return {
					id: crypto.randomUUID(),
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

		throw lastError ?? new Error("Gemini request failed after retries")
	}
}

interface GeminiResponse {
	candidates: Array<{
		content: { parts: Array<{ text: string }>; role: string }
		finishReason: string
	}>
	usageMetadata: {
		promptTokenCount: number
		candidatesTokenCount: number
		totalTokenCount: number
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
