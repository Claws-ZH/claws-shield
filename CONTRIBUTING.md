# Contributing to Claws-Shield | 贡献指南

Thank you for your interest in contributing! | 感谢你有兴趣参与贡献！

## How to Contribute | 如何贡献

### Reporting Issues | 报告问题

- Use GitHub Issues
- Include reproduction steps | 包含复现步骤
- Specify your Node.js and OS version | 标明 Node.js 和操作系统版本

### Pull Requests

1. Fork the repository | Fork 仓库
2. Create a feature branch | 创建功能分支
   ```bash
   git checkout -b feature/my-feature
   ```
3. Make your changes | 进行修改
4. Run tests | 运行测试
   ```bash
   pnpm vitest run
   ```
5. Build | 构建
   ```bash
   pnpm turbo build
   ```
6. Submit a PR | 提交 PR

### Code Style | 代码风格

- TypeScript strict mode
- Use Biome for formatting | 使用 Biome 格式化
  ```bash
  pnpm biome check .
  ```
- No `any` types unless interfacing with external JSON
- Prefer `const` over `let`

### Knowledge Base Contributions | 知识库贡献

If you've discovered new feature flags, codenames, or telemetry endpoints:

如果你发现了新的功能开关、代号或遥测端点：

1. Add data to the appropriate JSON file in `knowledge-base/`
2. Validate against the schema | 验证模式
3. Include evidence/source reference | 包含证据/来源引用

### Scanner Rule Contributions | 扫描规则贡献

New detection rules are welcome | 欢迎新的检测规则：

1. Create rule file in `packages/scanner/src/rules/<category>/`
2. Implement the `ScanRule` interface
3. Add test fixtures (safe + malicious samples)
4. Register in `packages/scanner/src/rules/index.ts`

## Development Setup | 开发环境

```bash
# Clone
git clone https://github.com/your-org/claws-shield.git
cd claws-shield

# Install
pnpm install

# Build
pnpm turbo build

# Test
pnpm vitest run

# Dev mode (watch)
pnpm turbo dev
```

## Language | 语言

- Code: English
- Comments: English
- Documentation: Bilingual (EN/CN) | 双语（英/中）
- Issues/PRs: English or Chinese | 英文或中文均可

## License | 许可

By contributing, you agree that your contributions will be licensed under the MIT License.

参与贡献即表示您同意您的贡献将在 MIT 许可下发布。
