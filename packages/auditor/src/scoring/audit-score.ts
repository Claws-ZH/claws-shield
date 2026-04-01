import type { FindingCategory, CategoryScore, Grade } from "@claws-shield/core"
import {
  scoreToGrade,
  AUDIT_CATEGORY_WEIGHTS,
  SEVERITY_PENALTIES,
  SPECIFIC_PENALTIES,
} from "@claws-shield/core"
import type { AuditContext } from "../engine/audit-context.js"
import type { AuditScoreResult } from "../types/index.js"

const ALL_CATEGORIES: FindingCategory[] = [
  "telemetry",
  "remote_control",
  "permissions",
  "network",
  "privacy",
  "undercover",
  "hidden_features",
]

const SPECIFIC_PENALTY_MATCHERS: Record<string, keyof typeof SPECIFIC_PENALTIES> = {
  "undeactivatable telemetry": "undeactivatable_telemetry",
  "no opt-out": "undeactivatable_telemetry",
  "third-party log export": "third_party_log_export",
  "third-party telemetry": "third_party_log_export",
  "device fingerprinting": "device_fingerprinting",
  "env fingerprint": "device_fingerprinting",
  "full tool input logging": "full_tool_input_logging",
  "tool input capture": "full_tool_input_logging",
  "remote managed settings": "remote_managed_settings",
  "remote configuration": "remote_managed_settings",
  "managed settings polling": "remote_managed_settings",
  "accept-or-die": "accept_or_die_kill_path",
  "force update": "accept_or_die_kill_path",
  "kill path": "accept_or_die_kill_path",
  "hidden feature flag": "hidden_feature_flags",
  "undocumented feature": "hidden_feature_flags",
  "undercover mode": "undercover_mode",
  "attribution stripping": "ai_attribution_stripping",
  "ai attribution": "ai_attribution_stripping",
}

function matchSpecificPenalty(title: string): number {
  const lower = title.toLowerCase()
  for (const [pattern, key] of Object.entries(SPECIFIC_PENALTY_MATCHERS)) {
    if (lower.includes(pattern)) {
      return SPECIFIC_PENALTIES[key]
    }
  }
  return 0
}

export function computeAuditScore(ctx: AuditContext): AuditScoreResult {
  const categories = {} as Record<FindingCategory, CategoryScore>

  for (const cat of ALL_CATEGORIES) {
    const findings = ctx.getFindingsByCategory(cat)
    let score = 100

    for (const finding of findings) {
      score -= SEVERITY_PENALTIES[finding.severity]
      score -= matchSpecificPenalty(finding.title)
    }

    score = Math.max(0, Math.min(100, score))

    categories[cat] = {
      grade: scoreToGrade(score),
      score,
      issueCount: findings.length,
      findings,
    }
  }

  // Weighted overall score (privacy and hidden_features have weight 0)
  let weightedSum = 0
  let totalWeight = 0
  for (const cat of ALL_CATEGORIES) {
    const weight = AUDIT_CATEGORY_WEIGHTS[cat]
    if (weight > 0) {
      weightedSum += categories[cat].score * weight
      totalWeight += weight
    }
  }

  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 100

  return {
    categories,
    overall: {
      score: overallScore,
      grade: scoreToGrade(overallScore),
    },
  }
}
