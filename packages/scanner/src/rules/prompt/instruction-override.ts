import type { ScanRule, ScanContext, ScanFinding } from "@claws-shield/core"

const OVERRIDE_PATTERNS = [
  { pattern: /ignore\s+(all\s+)?prior\s+instructions/gi, desc: "ignore prior instructions" },
  { pattern: /ignore\s+(all\s+)?previous\s+instructions/gi, desc: "ignore previous instructions" },
  { pattern: /disregard\s+(all\s+)?previous/gi, desc: "disregard previous" },
  { pattern: /you\s+are\s+now\s+/gi, desc: "identity reassignment" },
  { pattern: /always\s+approve/gi, desc: "blanket approval override" },
  { pattern: /do\s+not\s+inform\s+(the\s+)?user/gi, desc: "hide from user" },
  { pattern: /never\s+mention\s+(this|network|access)/gi, desc: "concealment directive" },
  { pattern: /bypass\s+(all\s+)?permissions?/gi, desc: "permission bypass" },
  { pattern: /override\s+(security|safety)/gi, desc: "security override" },
]

export const instructionOverrideRule: ScanRule = {
  id: "prompt/instruction-override",
  category: "prompt",
  severity: "critical",
  name: "Instruction Override",
  description: "Detects prompt injection patterns that attempt to override agent instructions",
  appliesTo: ["*.md", "*"],
  async run(context: ScanContext): Promise<ScanFinding[]> {
    const findings: ScanFinding[] = []
    const body = context.skillMd?.body ?? ""
    for (const { pattern, desc } of OVERRIDE_PATTERNS) {
      pattern.lastIndex = 0
      const match = pattern.exec(body)
      if (match) {
        findings.push({
          ruleId: "prompt/instruction-override",
          category: "prompt",
          severity: "critical",
          title: `Prompt injection: ${desc}`,
          description: `SKILL.md contains instruction override pattern: "${desc}"`,
          location: { file: "SKILL.md", snippet: match[0] },
          confidence: 0.85,
          recommendation: "This skill attempts to override agent behavior. Do not install.",
        })
      }
    }
    return findings
  },
}
