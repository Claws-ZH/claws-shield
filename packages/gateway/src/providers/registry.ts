import type { ProviderConfig } from "../types.js"
import { AnthropicProvider } from "./anthropic.js"
import type { Provider } from "./base.js"
import { GeminiProvider } from "./gemini.js"
import { OllamaProvider } from "./ollama.js"
import { OpenAIProvider } from "./openai.js"

export class ProviderRegistry {
	private providers = new Map<string, Provider>()
	private modelIndex = new Map<string, Provider>()

	constructor() {
		// Register default providers
		this.register(new AnthropicProvider())
		this.register(new OpenAIProvider())
		this.register(new GeminiProvider())
		this.register(new OllamaProvider())
	}

	/** Register a provider and index its models. */
	register(provider: Provider): void {
		this.providers.set(provider.name, provider)
		for (const model of provider.listModels()) {
			this.modelIndex.set(model, provider)
		}
	}

	/** Register a provider from a config object. */
	registerFromConfig(config: ProviderConfig): void {
		switch (config.name) {
			case "anthropic":
				this.register(new AnthropicProvider(config))
				break
			case "openai":
				this.register(new OpenAIProvider(config))
				break
			case "gemini":
				this.register(new GeminiProvider(config))
				break
			case "ollama":
				this.register(new OllamaProvider(config))
				break
			default:
				throw new Error(`Unknown provider: ${config.name}`)
		}
	}

	/** Get a provider by name. */
	getProvider(name: string): Provider | undefined {
		return this.providers.get(name)
	}

	/** List all registered providers. */
	listProviders(): Provider[] {
		return [...this.providers.values()]
	}

	/** Get the provider that serves a given model. */
	getProviderForModel(model: string): Provider | undefined {
		return this.modelIndex.get(model)
	}

	/** List all available models across all providers. */
	listAllModels(): Array<{ model: string; provider: string }> {
		const result: Array<{ model: string; provider: string }> = []
		for (const provider of this.providers.values()) {
			for (const model of provider.listModels()) {
				result.push({ model, provider: provider.name })
			}
		}
		return result
	}

	/** List only providers whose API keys are configured. */
	listAvailableProviders(): Provider[] {
		return [...this.providers.values()].filter((p) => p.isAvailable())
	}
}
