# 🛡️ Claws-Shield

**The world's most powerful AI Agent audit & governance toolkit.**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

> Born from deep reverse-engineering of Claude Code v2.1.88 (512K lines of TypeScript).
> Now available for auditing **any** AI coding tool.

---

## What is Claws-Shield?

Claws-Shield is a monorepo of 4 tools that bring transparency and security to AI coding agents:

| Tool | Description |
|------|-------------|
| **Agent Auditor** | Audit any AI tool for telemetry, remote control, permissions, privacy, and hidden features. Generates A-F graded reports. |
| **Agent Intelligence** | Research-backed database of 250+ feature flags, model codenames, hidden features, and version diffs. |
| **Skill Security Scanner** | Scan OpenClaw skills for malware, prompt injection, obfuscation, supply chain attacks, and data exfiltration. |
| **Agent Gateway** | Multi-model routing proxy (Claude, GPT, Gemini, Ollama) with cost optimization and fallback chains. |

## Quick Start

### CLI (standalone)

```bash
npx @claws-shield/cli audit ./path-to-ai-tool-source
npx @claws-shield/cli scan ./path-to-skill
npx @claws-shield/cli intel "capybara codename"
npx @claws-shield/cli gateway --port 8787
```

### OpenClaw Skills (one-click install)

Install from ClawHub:
- `agent-auditor` — Full AI tool audit
- `agent-intelligence` — Intel database queries
- `skill-security-scanner` — Skill safety checks
- `agent-gateway` — Multi-model routing

### Programmatic Usage

```typescript
import { runAudit, formatMarkdown } from "@claws-shield/auditor"
import { scanSkill } from "@claws-shield/scanner"
import { loadIntelDatabase, searchAll } from "@claws-shield/intel"
import { Router, ProviderRegistry } from "@claws-shield/gateway"

// Audit an AI tool
const report = await runAudit("./claude-code-source")
console.log(formatMarkdown(report))

// Scan a skill for security issues
const scan = await scanSkill("./my-skill")
console.log(scan.securityGrade) // "A"

// Query intelligence database
const db = loadIntelDatabase()
const results = searchAll(db, "telemetry")

// Route LLM requests
const registry = new ProviderRegistry()
const router = new Router(registry)
const response = await router.route({
  messages: [{ role: "user", content: "Hello" }]
}, "cheapest")
```

## Audit Report

The Agent Auditor produces a comprehensive report with:

- **Overall Grade** (A-F) and score (0-100)
- **7 Analysis Categories**: Telemetry, Remote Control, Undercover Mode, Permissions, Network, Hidden Features, Privacy
- **Evidence** with source locations
- **Actionable Recommendations**

### Scoring Weights

| Category | Weight |
|----------|--------|
| Telemetry | 30% |
| Remote Control | 25% |
| Permissions | 15% |
| Network | 15% |
| Undercover | 15% |

### Grade Bands

| Grade | Score Range |
|-------|------------|
| A | 90-100 |
| B | 80-89 |
| C | 65-79 |
| D | 50-64 |
| F | 0-49 |

## Security Scanner Rules

15+ detection rules across 6 categories:

- **Malware** — Suspicious shell commands, credential harvesting
- **Prompt Injection** — Instruction overrides, permission bypasses
- **Obfuscation** — Base64 encoded commands, charcode tricks
- **Supply Chain** — Unsafe postinstall scripts, unpinned deps
- **Data Exfiltration** — Outbound network with sensitive data, env dumps
- **Composition** — Multi-signal attack pattern correlation

## Architecture

```
knowledge-base/ (JSON datasets — research moat)
       |
@claws-shield/core (types, schemas, scoring, KB loader)
       |
@claws-shield/intel    (query, diff, codename/flag lookup)
@claws-shield/scanner  (rule engine, parsers, security scoring)
@claws-shield/gateway  (provider adapters, router, usage tracking)
@claws-shield/auditor  (collectors, analyzers, audit scoring)
       |
@claws-shield/cli      (standalone CLI frontend)
skills/*               (4 OpenClaw skill wrappers)
```

## Packages

| Package | Description | Size |
|---------|-------------|------|
| `@claws-shield/core` | Shared types, scoring, KB loader | ~5KB |
| `@claws-shield/intel` | Intelligence query engine | ~15KB |
| `@claws-shield/scanner` | Security scanning rule engine | ~20KB |
| `@claws-shield/auditor` | Flagship audit engine (7 analyzers) | ~62KB |
| `@claws-shield/gateway` | Multi-model routing proxy | ~25KB |
| `@claws-shield/cli` | Standalone CLI | ~6KB |

## CI/CD Integration

Use in your CI pipeline:

```bash
# Fail if audit grade is below C
npx @claws-shield/cli audit ./source --fail-below C --score-only

# Fail on high-severity scan findings
npx @claws-shield/cli scan ./my-skill --fail-on high
```

Exit codes:
- `0` — Success
- `1` — Error
- `10` — Audit grade below threshold
- `20` — Scan findings above severity threshold

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm turbo build

# Run tests
pnpm vitest run

# Lint
pnpm biome check .
```

## Knowledge Base

The intelligence database is built from deep reverse-engineering analysis:

- **Telemetry endpoints** — Known data collection destinations
- **Feature flags** — 250+ documented `tengu_*` flags with decoded purposes
- **Model codenames** — Capybara, Tengu, Fennec, Numbat mappings
- **Killswitches** — 6 remote control mechanisms
- **Managed settings** — Polling infrastructure, accept-or-die behavior
- **Undercover mode** — Attribution stripping rules
- **Hidden features** — 17+ unreleased tools behind feature gates

## Privacy

Claws-Shield is designed with privacy at its core:

- **All analysis is local** — No data sent to external servers
- **No telemetry** — We don't collect usage data
- **No API keys stored** — Gateway keys stay in your environment
- **Open source** — Fully auditable code

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. Contributions welcome in both English and Chinese.

## License

[MIT](LICENSE)

---

**Built with transparency in mind.** If an AI tool audits your code, shouldn't you be able to audit it back?
