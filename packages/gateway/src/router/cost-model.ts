/** Cost per 1M tokens: { input, output } in USD */
export interface ModelCost {
  input: number
  output: number
}

const PRICING: Record<string, Record<string, ModelCost>> = {
  anthropic: {
    "claude-opus-4-6":   { input: 15.0,  output: 75.0 },
    "claude-sonnet-4-6": { input: 3.0,   output: 15.0 },
    "claude-haiku-4-5":  { input: 0.80,  output: 4.0  },
  },
  openai: {
    "gpt-4o":       { input: 2.50, output: 10.0 },
    "gpt-4o-mini":  { input: 0.15, output: 0.60 },
    "o1":           { input: 15.0, output: 60.0 },
    "o1-mini":      { input: 3.0,  output: 12.0 },
  },
  gemini: {
    "gemini-2.0-flash": { input: 0.10, output: 0.40 },
    "gemini-2.5-pro":   { input: 1.25, output: 10.0 },
  },
  ollama: {
    // Local models are free
  },
}

/**
 * Get the cost per 1M tokens for a given provider/model.
 * Returns { input: 0, output: 0 } for unknown or local models.
 */
export function getModelCost(provider: string, model: string): ModelCost {
  return PRICING[provider]?.[model] ?? { input: 0, output: 0 }
}

/**
 * Calculate actual cost in USD for a given token count.
 */
export function calculateCost(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const cost = getModelCost(provider, model)
  return (promptTokens * cost.input + completionTokens * cost.output) / 1_000_000
}

/** Quality ranking (higher = better). Used for routing strategies. */
const QUALITY_RANKING: Record<string, number> = {
  "claude-opus-4-6":   95,
  "o1":                93,
  "gemini-2.5-pro":    90,
  "claude-sonnet-4-6": 85,
  "gpt-4o":            85,
  "o1-mini":           75,
  "claude-haiku-4-5":  70,
  "gpt-4o-mini":       65,
  "gemini-2.0-flash":  60,
}

export function getQualityScore(model: string): number {
  return QUALITY_RANKING[model] ?? 50
}
