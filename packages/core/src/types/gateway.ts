export type RoutingStrategy = "cheapest" | "best_quality" | "balanced"
export type ProviderId = "anthropic" | "openai" | "gemini" | "ollama"

export interface GatewayRequest {
  taskType?: "chat" | "code" | "analysis" | "long_context" | "cheap_fast"
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  preferredModel?: string
  preferredProvider?: ProviderId
  maxTokens?: number
  temperature?: number
  stream?: boolean
  metadata?: Record<string, unknown>
}

export interface GatewayResponse {
  provider: ProviderId
  model: string
  content: string
  usage: {
    inputTokens: number
    outputTokens: number
    estimatedCost: number
  }
  latencyMs: number
  fallbacksUsed: number
}

export interface ProviderHealth {
  provider: ProviderId
  healthy: boolean
  latencyMs?: number
  lastChecked: string
  errorRate: number
  rateLimited: boolean
}

export interface UsageRecord {
  timestamp: string
  provider: ProviderId
  model: string
  inputTokens: number
  outputTokens: number
  estimatedCost: number
  latencyMs: number
  success: boolean
  fallbacksUsed: number
}
