import type { Severity } from "./common.js"

export type ScanRuleCategory =
  | "malware"
  | "prompt"
  | "obfuscation"
  | "supply_chain"
  | "exfil"
  | "composition"

export interface ScanFinding {
  ruleId: string
  category: ScanRuleCategory
  severity: Severity
  title: string
  description: string
  location?: {
    file: string
    line?: number
    snippet?: string
  }
  confidence: number
  recommendation?: string
}

export interface ScanContext {
  skillPath: string
  files: Map<string, string> // path -> content
  skillMd?: {
    frontmatter: Record<string, unknown>
    body: string
  }
  packageJson?: Record<string, unknown>
}

export interface ScanRule {
  id: string
  category: ScanRuleCategory
  severity: Severity
  name: string
  description: string
  appliesTo: string[] // glob patterns for file types
  run(context: ScanContext): Promise<ScanFinding[]>
}
