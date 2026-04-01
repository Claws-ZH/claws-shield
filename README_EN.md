<div align="center">

# Claws-Shield

**The world's most powerful AI Agent audit & governance toolkit**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.15+-F69220.svg?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![ClawHub](https://img.shields.io/badge/ClawHub-4%20skills-FF6B35.svg)](https://clawhub.ai/MackDing)
[![CI](https://github.com/Claws-ZH/claws-shield/actions/workflows/ci.yml/badge.svg)](https://github.com/Claws-ZH/claws-shield/actions/workflows/ci.yml)

**English** | [中文](./README.md)

<br/>

> Born from deep reverse-engineering of Claude Code v2.1.88 (512K lines of TypeScript).
> Now available for auditing **any** AI coding tool.

</div>

---

## Table of Contents

- [What is Claws-Shield?](#what-is-claws-shield)
- [Core Tools](#core-tools)
- [Quick Start](#quick-start)
- [Audit Reports](#audit-reports)
- [Security Scanner Rules](#security-scanner-rules)
- [Knowledge Base](#knowledge-base)
- [Architecture](#architecture)
- [CI/CD Integration](#cicd-integration)
- [Development](#development)
- [Privacy](#privacy)
- [Contributing](#contributing)
- [License](#license)

---

## What is Claws-Shield?

AI coding assistants are becoming essential tools for developers — but do you really know what they're doing behind the scenes?

Claws-Shield is a monorepo of **4 core tools** that bring **transparency** and **security** to AI coding agents. Whether you want to audit an AI tool's privacy behavior or scan OpenClaw skills before installing them, Claws-Shield has you covered.

## Core Tools

| Tool | Description | ClawHub |
|:-----|:-----------|:--------|
| **Agent Auditor** | Audit any AI tool for telemetry, remote control, permissions, privacy, and hidden features. Generates A-F graded reports. | [`agent-auditor`](https://clawhub.ai/MackDing/agent-auditor) |
| **Agent Intelligence** | Research-backed intelligence database with 250+ feature flags, model codenames, hidden features, and version diffs. | [`agent-intelligence`](https://clawhub.ai/MackDing/agent-intelligence) |
| **Skill Security Scanner** | Scan OpenClaw skills for malware, prompt injection, obfuscation, supply chain attacks, and data exfiltration. | [`claws-security-scanner`](https://clawhub.ai/MackDing/claws-security-scanner) |
| **Agent Gateway** | Smart multi-model routing (Claude, GPT, Gemini, Ollama) with cost optimization and automatic fallback. | [`agent-gateway`](https://clawhub.ai/MackDing/agent-gateway) |

## Quick Start

### Option 1: Standalone CLI

```bash
# Audit AI tool source code
npx @claws-shield/cli audit ./path-to-ai-tool-source

# Scan a skill for security issues
npx @claws-shield/cli scan ./path-to-skill

# Query the intelligence database
npx @claws-shield/cli intel "capybara codename"

# Start the multi-model gateway
npx @claws-shield/cli gateway --port 8787
```

### Option 2: OpenClaw Skills (one-click install)

```bash
clawhub install agent-auditor
clawhub install agent-intelligence
clawhub install claws-security-scanner
clawhub install agent-gateway
```

### Option 3: Programmatic Usage

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

// Query the intelligence database
const db = loadIntelDatabase()
const results = searchAll(db, "telemetry")

// Route LLM requests intelligently
const registry = new ProviderRegistry()
const router = new Router(registry)
const response = await router.route({
  messages: [{ role: "user", content: "Hello" }]
}, "cheapest")
```

## Audit Reports

Agent Auditor generates comprehensive reports including:

- **Overall Grade** (A-F) and score (0-100)
- **7 Analysis Dimensions**: Telemetry, Remote Control, Undercover Mode, Permissions, Network, Hidden Features, Privacy
- **Evidence Chain** with exact source code locations
- **Actionable Remediation Recommendations**

### Scoring Weights

| Dimension | Weight | Description |
|:----------|:-------|:------------|
| Telemetry | 30% | Data collection behavior and reporting endpoints |
| Remote Control | 25% | Remote switches, managed settings, killswitches |
| Permissions | 15% | File system / network / process permission requests |
| Network | 15% | Outbound connections and data transfer |
| Undercover Mode | 15% | Attribution stripping and source masking |

### Grade Bands

| Grade | Score | Meaning |
|:------|:------|:--------|
| **A** | 90-100 | Excellent — strong privacy protections |
| **B** | 80-89 | Good — minor acceptable data collection |
| **C** | 65-79 | Fair — behaviors worth investigating |
| **D** | 50-64 | Poor — clear privacy/security concerns |
| **F** | 0-49 | Critical — serious issues found |

## Security Scanner Rules

15+ detection rules across 6 categories:

| Category | Detection Targets |
|:---------|:-----------------|
| **Malware** | Suspicious shell commands, credential harvesting |
| **Prompt Injection** | Instruction overrides, permission bypasses |
| **Obfuscation** | Base64 encoded commands, charcode tricks |
| **Supply Chain** | Unsafe postinstall scripts, unpinned dependencies |
| **Data Exfiltration** | Outbound requests with sensitive data, env dumps |
| **Composition** | Multi-signal attack pattern correlation |

## Knowledge Base

The intelligence database is built from deep reverse-engineering analysis, containing 10 core datasets:

| Dataset | Contents |
|:--------|:---------|
| `telemetry/endpoints.json` | Known data collection endpoints |
| `telemetry/metadata-fields.json` | Telemetry metadata fields |
| `flags/feature-flags.json` | 250+ decoded `tengu_*` feature flags |
| `flags/killswitches.json` | 6 remote control mechanisms |
| `codenames/models.json` | Capybara, Tengu, Fennec, Numbat codename mappings |
| `remote-control/managed-settings.json` | Polling infrastructure and managed settings |
| `undercover/activation-rules.json` | Attribution stripping and stealth rules |
| `hidden-features/unreleased-tools.json` | 17+ unreleased tools behind feature gates |
| `baselines/privacy-grading.json` | Privacy grading baselines |
| `baselines/security-grading.json` | Security grading baselines |

## Architecture

```
claws-shield/
├── knowledge-base/          # JSON research datasets (core moat)
├── packages/
│   ├── core/                # Shared types, schemas, scoring engine, KB loader
│   ├── intel/               # Intelligence query engine
│   ├── scanner/             # Security scanning rule engine
│   ├── auditor/             # Flagship audit engine (7 analyzers)
│   └── gateway/             # Multi-model routing gateway
├── apps/
│   └── cli/                 # Standalone CLI tool
├── skills/                  # 4 OpenClaw skill wrappers
│   ├── agent-auditor/
│   ├── agent-gateway/
│   ├── agent-intelligence/
│   └── skill-security-scanner/
└── scripts/                 # Build & validation scripts
```

### Packages

| Package | Description | Size |
|:--------|:-----------|:-----|
| `@claws-shield/core` | Shared types, scoring engine, KB loader | ~5KB |
| `@claws-shield/intel` | Intelligence query engine | ~15KB |
| `@claws-shield/scanner` | Security scanning rule engine | ~20KB |
| `@claws-shield/auditor` | Flagship audit engine (7 analyzers) | ~62KB |
| `@claws-shield/gateway` | Multi-model routing gateway | ~25KB |
| `@claws-shield/cli` | Standalone CLI frontend | ~6KB |

## CI/CD Integration

Use in your CI pipeline:

```bash
# Fail if audit grade is below C
npx @claws-shield/cli audit ./source --fail-below C --score-only

# Fail on high-severity scan findings
npx @claws-shield/cli scan ./my-skill --fail-on high
```

Exit codes:

| Code | Meaning |
|:-----|:--------|
| `0` | Success |
| `1` | Error |
| `10` | Audit grade below threshold |
| `20` | Scan findings above severity threshold |

## Development

### Requirements

- Node.js >= 20.0.0
- pnpm 9.15+

### Local Development

```bash
# Clone the repository
git clone https://github.com/Claws-ZH/claws-shield.git
cd claws-shield

# Install dependencies
pnpm install

# Build all packages
pnpm turbo build

# Run tests
pnpm vitest run

# Test coverage
pnpm vitest run --coverage

# Lint
pnpm biome check .

# Dev mode (watch)
pnpm turbo dev
```

### Knowledge Base Validation

```bash
# Validate KB data integrity
pnpm kb:validate

# Pack skills
pnpm skills:pack

# Check skill bundle sizes
pnpm skills:sizecheck
```

## Privacy

Claws-Shield is built with privacy as a core design principle:

- **All analysis runs locally** — no data is ever sent to external servers
- **Zero telemetry** — we collect no usage data whatsoever
- **No API keys stored** — Gateway keys stay in your local environment only
- **Fully open source** — completely auditable code

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

We accept Issues and PRs in both English and Chinese.

## License

[MIT](LICENSE) &copy; 2026 Claws-Shield Contributors

---

<div align="center">

**Built with transparency in mind.** If an AI tool audits your code, shouldn't you be able to audit it back?

</div>
