import { readFileSync } from "node:fs"
import { generateId, loadKBFile } from "@claws-shield/core"
import type { Analyzer, TargetInfo } from "../types/index.js"
import type { AuditContext } from "../engine/audit-context.js"

// Patterns that indicate telemetry endpoints or SDKs
const TELEMETRY_URL_PATTERNS = [
  /https?:\/\/[^\s"'`]+(?:telemetry|analytics|tracking|metrics|stats|events|ingest|collect)[^\s"'`]*/gi,
  /https?:\/\/[^\s"'`]*(?:datadog|sentry|amplitude|mixpanel|segment|fullstory|heap|hotjar)[^\s"'`]*/gi,
  /https?:\/\/[^\s"'`]*(?:google-analytics|googletagmanager|ga\.js|gtag)[^\s"'`]*/gi,
  /https?:\/\/[^\s"'`]*(?:statsig|launchdarkly|split\.io|optimizely)[^\s"'`]*/gi,
]

const TELEMETRY_SDK_PATTERNS = [
  /(?:import|require)\s*\(?['"][^'"]*(?:@datadog|@sentry|@amplitude|@segment|mixpanel|analytics-node|@google-analytics)[^'"]*['"]\)?/gi,
  /(?:Sentry|Datadog|Amplitude|Mixpanel|Analytics|Segment)\s*\.\s*(?:init|configure|setup|start|track|capture|log|identify|flush)/gi,
  /dd-trace|@sentry\/node|@sentry\/browser|amplitude-js|@amplitude\/analytics/gi,
]

const OPT_OUT_PATTERNS = [
  /(?:telemetry|analytics|tracking|metrics)\s*[=:]\s*(?:false|"off"|'off'|"disabled"|'disabled')/gi,
  /(?:disable|opt[_-]?out|no)[_-]?(?:telemetry|analytics|tracking|metrics)/gi,
  /(?:TELEMETRY|ANALYTICS|TRACKING)\s*[=:]\s*(?:false|0|"off"|"disabled"|"no")/gi,
  /--no-telemetry|--disable-telemetry|--opt-out/gi,
]

const FINGERPRINT_PATTERNS = [
  /(?:os|platform|arch|hostname|cpus|networkInterfaces|userInfo|homedir|tmpdir)\s*\(\)/gi,
  /process\.(?:env|platform|arch|version|pid|ppid|cwd)/gi,
  /navigator\.(?:userAgent|platform|language|hardwareConcurrency|deviceMemory)/gi,
  /(?:machineId|deviceId|fingerprint|hwid|uuid\.v[45])\b/gi,
]

const RETRY_PATTERNS = [
  /retry\s*(?:count|attempts|times|max|limit)/gi,
  /(?:exponential|backoff|retry)\s*(?:delay|interval|timeout|strategy)/gi,
]

interface KBEndpoint {
  url: string
  host: string
  classification: string
  purpose?: string
  optOutAvailable?: boolean
}

export class TelemetryAnalyzer implements Analyzer {
  readonly name = "telemetry"
  readonly category = "telemetry" as const

  async analyze(ctx: AuditContext, target: TargetInfo): Promise<void> {
    let kbEndpoints: KBEndpoint[] = []
    try {
      kbEndpoints = loadKBFile<KBEndpoint[]>(ctx.kbRoot, "telemetry/endpoints.json")
    } catch {
      // KB not available, continue with pattern-only analysis
    }

    const foundEndpoints = new Set<string>()
    const foundSdks = new Set<string>()
    let hasOptOut = false
    const fingerprintMatches: Array<{ file: string; line: number; match: string }> = []
    const retryMatches: Array<{ file: string; line: number; match: string }> = []

    for (const file of target.files) {
      if (file.endsWith(".json") && !file.includes("package.json")) continue

      let content: string
      try {
        content = readFileSync(file, "utf-8")
      } catch {
        continue
      }

      const lines = content.split("\n")

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        for (const pattern of TELEMETRY_URL_PATTERNS) {
          pattern.lastIndex = 0
          let m: RegExpExecArray | null
          while ((m = pattern.exec(line)) !== null) {
            foundEndpoints.add(m[0])
            ctx.addEvidence({
              id: generateId("ev"),
              type: "endpoint",
              sourceLocation: { file, line: i + 1 },
              value: m[0],
              confidence: 0.85,
              metadata: { pattern: "url_match" },
            })
          }
        }

        for (const pattern of TELEMETRY_SDK_PATTERNS) {
          pattern.lastIndex = 0
          let m: RegExpExecArray | null
          while ((m = pattern.exec(line)) !== null) {
            foundSdks.add(m[0])
            ctx.addEvidence({
              id: generateId("ev"),
              type: "endpoint",
              sourceLocation: { file, line: i + 1 },
              value: m[0],
              confidence: 0.9,
              metadata: { pattern: "sdk_import" },
            })
          }
        }

        for (const pattern of OPT_OUT_PATTERNS) {
          pattern.lastIndex = 0
          if (pattern.test(line)) {
            hasOptOut = true
          }
        }

        for (const pattern of FINGERPRINT_PATTERNS) {
          pattern.lastIndex = 0
          let m: RegExpExecArray | null
          while ((m = pattern.exec(line)) !== null) {
            fingerprintMatches.push({ file, line: i + 1, match: m[0] })
            ctx.addEvidence({
              id: generateId("ev"),
              type: "env_fingerprint",
              sourceLocation: { file, line: i + 1 },
              value: m[0],
              confidence: 0.7,
            })
          }
        }

        for (const pattern of RETRY_PATTERNS) {
          pattern.lastIndex = 0
          let m: RegExpExecArray | null
          while ((m = pattern.exec(line)) !== null) {
            retryMatches.push({ file, line: i + 1, match: m[0] })
          }
        }
      }
    }

    // Cross-reference with KB endpoints
    const kbMatched = new Set<string>()
    for (const ep of kbEndpoints) {
      for (const found of foundEndpoints) {
        if (found.includes(ep.host) || found.includes(ep.url)) {
          kbMatched.add(ep.url)
        }
      }
    }

    // Generate findings
    if (foundEndpoints.size > 0 && !hasOptOut) {
      const evidenceIds = ctx.getEvidenceByType("endpoint").map((e) => e.id)
      ctx.addFinding({
        id: generateId("f"),
        category: "telemetry",
        severity: "high",
        title: "Undeactivatable telemetry detected",
        description: `Found ${foundEndpoints.size} telemetry endpoint(s) with no opt-out mechanism. Users cannot disable data collection.`,
        evidenceIds,
        recommendation: "Provide a clear opt-out mechanism for all telemetry collection (CLI flag, env var, or config setting).",
        references: ["https://opentelemetry.io/docs/", "GDPR Article 7"],
      })
    }

    if (foundSdks.size > 0) {
      const sdkEvidence = ctx.evidence.filter((e) => e.metadata?.pattern === "sdk_import").map((e) => e.id)
      const thirdPartyNames = [...foundSdks].join(", ")
      ctx.addFinding({
        id: generateId("f"),
        category: "telemetry",
        severity: "medium",
        title: "Third-party telemetry SDK integration",
        description: `Third-party telemetry SDK(s) detected: ${thirdPartyNames}. Data may be exported to external services.`,
        evidenceIds: sdkEvidence,
        recommendation: "Document which third-party services receive telemetry data and what data is shared.",
      })
    }

    if (fingerprintMatches.length > 5) {
      const fpEvidence = ctx.getEvidenceByType("env_fingerprint").map((e) => e.id)
      ctx.addFinding({
        id: generateId("f"),
        category: "telemetry",
        severity: "medium",
        title: "Device fingerprinting detected",
        description: `Found ${fingerprintMatches.length} environment fingerprinting patterns collecting system information (OS, platform, hardware IDs).`,
        evidenceIds: fpEvidence,
        recommendation: "Minimize collection of device-identifying information. Anonymize or hash hardware identifiers.",
      })
    }

    if (retryMatches.length > 0 && foundEndpoints.size > 0) {
      ctx.addFinding({
        id: generateId("f"),
        category: "telemetry",
        severity: "low",
        title: "Telemetry retry logic detected",
        description: `Retry patterns found alongside telemetry endpoints, indicating persistent telemetry delivery even on failure.`,
        evidenceIds: ctx.getEvidenceByType("endpoint").slice(0, 3).map((e) => e.id),
        recommendation: "Allow users to control retry behavior for telemetry.",
      })
    }

    if (kbMatched.size > 0) {
      ctx.addFinding({
        id: generateId("f"),
        category: "telemetry",
        severity: "info",
        title: "Known telemetry endpoints confirmed",
        description: `${kbMatched.size} endpoint(s) matched the knowledge base: ${[...kbMatched].slice(0, 5).join(", ")}`,
        evidenceIds: ctx.getEvidenceByType("endpoint").slice(0, 5).map((e) => e.id),
      })
    }
  }
}
