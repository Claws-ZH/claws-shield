import type { ProviderId, RoutingStrategy } from "@claws-shield/core"

export type { RoutingStrategy, ProviderId }

export interface ProviderConfig {
	name: string
	apiKey?: string
	baseUrl?: string
	models: string[]
	maxRetries?: number
	timeout?: number
}

export interface RouteRequest {
	model?: string
	messages: Array<{ role: string; content: string }>
	temperature?: number
	maxTokens?: number
	stream?: boolean
}

export interface RouteResponse {
	id: string
	model: string
	provider: string
	content: string
	usage: { promptTokens: number; completionTokens: number; totalTokens: number }
	latency: number
	cost: number
}
