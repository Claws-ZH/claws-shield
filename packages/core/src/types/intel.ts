export interface ModelCodename {
  codename: string
  kind: "model" | "product_prefix" | "feature_set"
  mapsTo?: string
  status: "active" | "deprecated" | "upcoming" | "unknown"
  visibility: "internal" | "external" | "both"
  notes: string[]
  firstSeenVersion?: string
  evidence: Array<{ file: string; description: string }>
}

export interface FeatureFlag {
  flag: string
  category: "killswitch" | "feature_gate" | "experiment" | "rollout" | "unknown"
  decodedPurpose: string
  productArea: string
  availability: "internal_only" | "external_only" | "both" | "unknown"
  sourceSystem: "growthbook" | "statsig" | "env" | "api" | "unknown"
  defaultState: "enabled" | "disabled" | "unknown"
  riskLevel: "critical" | "high" | "medium" | "low" | "info"
  description: string
  relatedFlags: string[]
  evidence: Array<{ version: string; file: string }>
}

export interface UnreleasedTool {
  name: string
  status: "implemented_gated" | "partial" | "stub" | "unknown"
  capabilityArea: string
  featureFlags: string[]
  riskProfile: string[]
  description: string
  evidence: Array<{ version: string; file: string }>
}

export interface VersionDiff {
  fromVersion: string
  toVersion: string
  addedFlags: FeatureFlag[]
  removedFlags: FeatureFlag[]
  changedFlags: Array<{ flag: FeatureFlag; changes: string[] }>
  addedTools: UnreleasedTool[]
  removedTools: string[]
  telemetryChanges: string[]
  summary: string
}
