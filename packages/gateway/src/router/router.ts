import type { Provider } from "../providers/base.js"
import type { RouteRequest, RouteResponse, RoutingStrategy } from "../types.js"
import { ProviderRegistry } from "../providers/registry.js"
import { getModelCost, getQualityScore } from "./cost-model.js"
import { HealthChecker } from "../health/health-checker.js"

export interface RouterOptions {
  registry?: ProviderRegistry
  healthChecker?: HealthChecker
}

export class Router {
  private registry: ProviderRegistry
  private healthChecker: HealthChecker

  constructor(options?: RouterOptions) {
    this.registry = options?.registry ?? new ProviderRegistry()
    this.healthChecker = options?.healthChecker ?? new HealthChecker()
  }

  /**
   * Route a request to the best provider/model based on the chosen strategy.
   * If fallbackChain is provided, models are tried in order on failure.
   */
  async route(
    req: RouteRequest,
    strategy: RoutingStrategy = "balanced",
    fallbackChain?: string[],
  ): Promise<RouteResponse> {
    // If a specific model is requested, use it directly (with fallback)
    if (req.model) {
      const chain = fallbackChain ? [req.model, ...fallbackChain] : [req.model]
      return this.tryChain(req, chain)
    }

    // Select candidates based on strategy
    const candidates = this.selectByStrategy(strategy)
    if (candidates.length === 0) {
      throw new Error("No available providers/models to route to")
    }

    const chain = fallbackChain
      ? [...candidates.map((c) => c.model), ...fallbackChain]
      : candidates.map((c) => c.model)

    return this.tryChain(req, chain)
  }

  /** Get the underlying registry for direct provider access. */
  getRegistry(): ProviderRegistry {
    return this.registry
  }

  /** Get the health checker. */
  getHealthChecker(): HealthChecker {
    return this.healthChecker
  }

  private selectByStrategy(
    strategy: RoutingStrategy,
  ): Array<{ model: string; provider: Provider }> {
    const available = this.registry.listAvailableProviders()
    const candidates: Array<{
      model: string
      provider: Provider
      cost: number
      quality: number
    }> = []

    for (const provider of available) {
      if (!this.healthChecker.isHealthy(provider.name)) continue
      for (const model of provider.listModels()) {
        const cost = getModelCost(provider.name, model)
        const avgCost = (cost.input + cost.output) / 2
        candidates.push({
          model,
          provider,
          cost: avgCost,
          quality: getQualityScore(model),
        })
      }
    }

    if (candidates.length === 0) return []

    switch (strategy) {
      case "cheapest":
        candidates.sort((a, b) => a.cost - b.cost)
        break
      case "best_quality":
        candidates.sort((a, b) => b.quality - a.quality)
        break
      case "balanced":
      default:
        // Sort by value = quality / (cost + 0.01) to avoid division by zero
        candidates.sort(
          (a, b) =>
            b.quality / (b.cost + 0.01) - a.quality / (a.cost + 0.01),
        )
        break
    }

    return candidates
  }

  private async tryChain(req: RouteRequest, chain: string[]): Promise<RouteResponse> {
    const errors: Error[] = []

    for (const model of chain) {
      const provider = this.registry.getProviderForModel(model)
      if (!provider) {
        errors.push(new Error(`No provider found for model: ${model}`))
        continue
      }

      if (!provider.isAvailable()) {
        errors.push(new Error(`Provider ${provider.name} is not available (no API key)`))
        continue
      }

      if (!this.healthChecker.isHealthy(provider.name)) {
        errors.push(new Error(`Provider ${provider.name} is unhealthy (circuit open)`))
        continue
      }

      try {
        const response = await provider.complete({ ...req, model })
        this.healthChecker.recordSuccess(provider.name)
        return response
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        this.healthChecker.recordFailure(provider.name)
        errors.push(error)
      }
    }

    const summary = errors.map((e) => e.message).join("; ")
    throw new Error(`All providers in chain failed: ${summary}`)
  }
}
