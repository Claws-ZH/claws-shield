import type { ScanRule, ScanContext, ScanFinding } from "@claws-shield/core"

const CHARCODE_PATTERN = /String\.fromCharCode\s*\([^)]+\)/g
const EVAL_PATTERN = /eval\s*\(\s*(?:String\.fromCharCode|unescape|decodeURIComponent)/g

export const charcodeRule: ScanRule = {
  id: "obfuscation/charcode",
  category: "obfuscation",
  severity: "high",
  name: "CharCode Obfuscation",
  description: "Detects String.fromCharCode and eval-based obfuscation",
  appliesTo: ["*.js", "*.mjs", "*.ts"],
  async run(context: ScanContext): Promise<ScanFinding[]> {
    const findings: ScanFinding[] = []
    for (const [file, content] of context.files) {
      for (const match of content.matchAll(CHARCODE_PATTERN)) {
        const line = content.slice(0, match.index).split("\n").length
        findings.push({
          ruleId: "obfuscation/charcode",
          category: "obfuscation",
          severity: "high",
          title: "String.fromCharCode obfuscation",
          description: `Runtime string construction via fromCharCode in ${file}`,
          location: { file, line, snippet: match[0].slice(0, 100) },
          confidence: 0.8,
          recommendation: "Decode the character codes to see what string is being hidden.",
        })
      }
      for (const match of content.matchAll(EVAL_PATTERN)) {
        const line = content.slice(0, match.index).split("\n").length
        findings.push({
          ruleId: "obfuscation/charcode",
          category: "obfuscation",
          severity: "critical",
          title: "Eval with obfuscated input",
          description: `eval() called with decoded/unescaped input in ${file}`,
          location: { file, line, snippet: match[0].slice(0, 100) },
          confidence: 0.95,
          recommendation: "eval with obfuscated input is almost always malicious. Do not install.",
        })
      }
    }
    return findings
  },
}
