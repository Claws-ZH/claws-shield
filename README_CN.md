# 🛡️ Claws-Shield

**全球最强大的 AI Agent 审计与治理工具包。**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

> 源自对 Claude Code v2.1.88（512K 行 TypeScript）的深度逆向工程。
> 现已支持审计**任意** AI 编码工具。

---

## 什么是 Claws-Shield？

Claws-Shield 是一个包含 4 个工具的 monorepo，为 AI 编码代理带来透明度和安全性：

| 工具 | 描述 |
|------|------|
| **Agent Auditor** | 审计任意 AI 工具的遥测、远程控制、权限、隐私和隐藏功能。生成 A-F 等级报告。 |
| **Agent Intelligence** | 基于研究的情报数据库，包含 250+ 功能开关、模型代号、隐藏功能和版本差异。 |
| **Skill Security Scanner** | 扫描 OpenClaw 技能中的恶意软件、提示注入、混淆、供应链攻击和数据外泄。 |
| **Agent Gateway** | 多模型路由代理（Claude、GPT、Gemini、Ollama），支持成本优化和故障转移。 |

## 快速开始

### CLI（独立使用）

```bash
npx @claws-shield/cli audit ./ai-工具源码路径
npx @claws-shield/cli scan ./技能路径
npx @claws-shield/cli intel "capybara codename"
npx @claws-shield/cli gateway --port 8787
```

### OpenClaw 技能（一键安装）

从 ClawHub 安装：
- `agent-auditor` — 完整 AI 工具审计
- `agent-intelligence` — 情报数据库查询
- `skill-security-scanner` — 技能安全检查
- `agent-gateway` — 多模型路由

### 编程使用

```typescript
import { runAudit, formatMarkdown } from "@claws-shield/auditor"
import { scanSkill } from "@claws-shield/scanner"
import { loadIntelDatabase, searchAll } from "@claws-shield/intel"
import { Router, ProviderRegistry } from "@claws-shield/gateway"

// 审计 AI 工具
const report = await runAudit("./claude-code-source")
console.log(formatMarkdown(report))

// 扫描技能安全问题
const scan = await scanSkill("./my-skill")
console.log(scan.securityGrade) // "A"

// 查询情报数据库
const db = loadIntelDatabase()
const results = searchAll(db, "telemetry")

// 路由 LLM 请求
const registry = new ProviderRegistry()
const router = new Router(registry)
const response = await router.route({
  messages: [{ role: "user", content: "你好" }]
}, "cheapest")
```

## 审计报告

Agent Auditor 生成全面的审计报告：

- **总体等级**（A-F）和分数（0-100）
- **7 个分析类别**：遥测、远程控制、隐身模式、权限、网络、隐藏功能、隐私
- **证据**，包含源代码位置
- **可操作的建议**

### 评分权重

| 类别 | 权重 |
|------|------|
| 遥测 | 30% |
| 远程控制 | 25% |
| 权限 | 15% |
| 网络 | 15% |
| 隐身模式 | 15% |

### 等级标准

| 等级 | 分数范围 |
|------|----------|
| A | 90-100 |
| B | 80-89 |
| C | 65-79 |
| D | 50-64 |
| F | 0-49 |

## 安全扫描规则

15+ 检测规则，覆盖 6 个类别：

- **恶意软件** — 可疑 shell 命令、凭证窃取
- **提示注入** — 指令覆盖、权限绕过
- **混淆** — Base64 编码命令、charcode 技巧
- **供应链** — 不安全的 postinstall 脚本、未固定的依赖
- **数据外泄** — 携带敏感数据的出站网络请求、环境变量转储
- **组合检测** — 多信号攻击模式关联

## 架构

```
knowledge-base/ (JSON 数据集 — 研究壁垒)
       |
@claws-shield/core (类型、模式、评分、KB 加载器)
       |
@claws-shield/intel    (查询、差异、代号/标志查找)
@claws-shield/scanner  (规则引擎、解析器、安全评分)
@claws-shield/gateway  (提供商适配器、路由、使用跟踪)
@claws-shield/auditor  (收集器、分析器、审计评分)
       |
@claws-shield/cli      (独立 CLI 前端)
skills/*               (4 个 OpenClaw 技能封装)
```

## 隐私

Claws-Shield 以隐私为核心设计：

- **所有分析均在本地进行** — 不向外部服务器发送数据
- **无遥测** — 我们不收集使用数据
- **不存储 API 密钥** — Gateway 密钥留在你的环境中
- **开源** — 完全可审计的代码

## 贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。欢迎中英文贡献。

## 许可证

[MIT](LICENSE)

---

**以透明为本。** 如果 AI 工具能审计你的代码，你难道不应该能审计它吗？
