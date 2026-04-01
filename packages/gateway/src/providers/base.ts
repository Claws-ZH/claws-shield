import type { RouteRequest, RouteResponse } from "../types.js"

export interface Provider {
  name: string
  isAvailable(): boolean
  listModels(): string[]
  complete(req: RouteRequest): Promise<RouteResponse>
  estimateCost(model: string, promptTokens: number, completionTokens: number): number
}
