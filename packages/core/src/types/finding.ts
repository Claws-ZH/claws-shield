import type { Severity } from "./common.js"

export type FindingCategory =
  | "telemetry"
  | "remote_control"
  | "permissions"
  | "network"
  | "privacy"
  | "undercover"
  | "hidden_features"

export interface Finding {
  id: string
  category: FindingCategory
  severity: Severity
  title: string
  description: string
  evidenceIds: string[]
  recommendation?: string
  references?: string[]
}
