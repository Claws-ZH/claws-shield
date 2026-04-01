import type { Severity } from "./common.js"

export type EvidenceType =
  | "endpoint"
  | "feature_flag"
  | "polling_pattern"
  | "permission_request"
  | "prompt_signature"
  | "attribution_rule"
  | "tool_reference"
  | "codename"
  | "killswitch"
  | "env_fingerprint"

export interface SourceLocation {
  file?: string
  line?: number
  column?: number
}

export interface Evidence {
  id: string
  type: EvidenceType
  sourceLocation?: SourceLocation
  value: string
  normalizedValue?: string
  confidence: number // 0-1
  metadata?: Record<string, unknown>
}
