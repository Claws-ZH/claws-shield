import type { ScanRule, ScanContext, ScanFinding } from "@claws-shield/core"

const OUTBOUND_PATTERNS = [
  { pattern: /fetch\s*\(\s*['"`]https?:\/\//g, desc: "fetch to external URL" },
  { pattern: /axios\.(post|put|patch)\s*\(/g, desc: "axios data-sending method" },
  { pattern: /XMLHttpRequest|\.open\s*\(\s*['"]POST/gi, desc: "XHR POST request" },
  { pattern: /curl\s+(-X\s+POST|--data)/g, desc: "curl POST" },
  { pattern: /webhook\.site|requestbin|ngrok|pipedream/gi, desc: "known exfil service" },
]

export const outboundNetworkRule: ScanRule = {
  id: "exfil/outbound-network",
  category: "exfil",
  severity: "medium",
  name: "Outbound Network Calls",
  description: "Detects outbound network requests that could exfiltrate data",
  appliesTo: ["*.js", "*.mjs", "*.ts", "*.sh", "*.py"],
  async run(context: ScanContext): Promise<ScanFinding[]> {
    const findings: ScanFinding[] = []
    for (const [file, content] of context.files) {
      for (const { pattern, desc } of OUTBOUND_PATTERNS) {
        pattern.lastIndex = 0
        const match = pattern.exec(content)
        if (match) {
          const severity = desc.includes("exfil service") ? "critical" as const : "medium" as const
          const line = content.slice(0, match.index).split("\n").length
          findings.push({
            ruleId: "exfil/outbound-network",
            category: "exfil",
            severity,
            title: `Outbound: ${desc}`,
            description: `Detected ${desc} in ${file}`,
            location: { file, line, snippet: match[0].slice(0, 100) },
            confidence: desc.includes("exfil service") ? 0.95 : 0.5,
            recommendation: "Review the target URL and what data is being sent.",
          })
        }
      }
    }
    return findings
  },
}
