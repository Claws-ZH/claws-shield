import type { Provider } from "./base.js"
import type { RouteRequest, RouteResponse, ProviderConfig } from "../types.js"

export class OllamaProvider implements Provider {
  readonly name = "ollama"
  private readonly baseUrl: string
  private readonly timeout: number
  private readonly maxRetries: number
  private cachedModels: string[] = []
  private lastModelFetch = 0

  constructor(config?: Partial<ProviderConfig>) {
    this.baseUrl = config?.baseUrl ?? "http://localhost:11434"
    this.timeout = config?.timeout ?? 60_000
    this.maxRetries = config?.maxRetries ?? 1
  }

  isAvailable(): boolean {
    // Ollama is available if the server is reachable — we optimistically return true
    // and handle errors in complete(). Callers can use health checks for real availability.
    return true
  }

  listModels(): string[] {
    return [...this.cachedModels]
  }

  /** Fetch the list of locally available models from Ollama. */
  async refreshModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) return []
      const data = (await response.json()) as OllamaTagsResponse
      this.cachedModels = data.models?.map((m) => m.name) ?? []
      this.lastModelFetch = Date.now()
      return this.cachedModels
    } catch {
      return []
    }
  }

  estimateCost(_model: string, _promptTokens: number, _completionTokens: number): number {
    return 0 // local models are free
  }

  async complete(req: RouteRequest): Promise<RouteResponse> {
    // Refresh model list if stale (> 60s)
    if (Date.now() - this.lastModelFetch > 60_000) {
      await this.refreshModels()
    }

    const model = req.model ?? this.cachedModels[0] ?? "llama3"
    const start = Date.now()
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeout)

        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: req.messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            stream: false,
            options: {
              temperature: req.temperature,
              num_predict: req.maxTokens,
            },
          }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const body = await response.text()
          throw new Error(`Ollama API error ${response.status}: ${body}`)
        }

        const data = (await response.json()) as OllamaChatResponse
        const latency = Date.now() - start
        const content = data.message?.content ?? ""

        const promptTokens = data.prompt_eval_count ?? 0
        const completionTokens = data.eval_count ?? 0

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
          cost: 0,
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt < this.maxRetries) {
          await sleep(1000 * (attempt + 1))
        }
      }
    }

    throw lastError ?? new Error("Ollama request failed after retries")
  }
}

interface OllamaTagsResponse {
  models: Array<{ name: string; modified_at: string; size: number }>
}

interface OllamaChatResponse {
  model: string
  message: { role: string; content: string }
  done: boolean
  prompt_eval_count?: number
  eval_count?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
