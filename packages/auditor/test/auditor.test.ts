import { describe, it, expect, beforeEach } from "vitest"
import { join } from "node:path"

import { AuditContext } from "../src/engine/audit-context.js"
import { loadTarget } from "../src/engine/target-loader.js"
import { computeAuditScore } from "../src/scoring/audit-score.js"
import { runAudit } from "../src/engine/audit-engine.js"
import { formatJson } from "../src/reporters/audit-json.js"
import { formatMarkdown } from "../src/reporters/audit-markdown.js"
import { formatTerminal } from "../src/reporters/audit-terminal.js"
import type { Evidence, Finding, AuditReport, FindingCategory, CategoryScore, Grade } from "../src/types/index.js"

const FIXTURES_DIR = join(__dirname, "fixtures", "sample-tool")

// ---------------------------------------------------------------------------
// 1. AuditContext
// ---------------------------------------------------------------------------
describe("AuditContext", () => {
  let ctx: AuditContext

  beforeEach(() => {
    ctx = new AuditContext("/tmp/fake-target", "")
  })

  it("addEvidence and retrieve evidence", () => {
    const e: Evidence = {
      id: "ev-1",
      type: "endpoint",
      value: "https://example.com/track",
      confidence: 0.9,
    }
    ctx.addEvidence(e)
    expect(ctx.evidence).toHaveLength(1)
    expect(ctx.evidence[0]).toEqual(e)
  })

  it("addFinding and retrieve findings", () => {
    const f: Finding = {
      id: "f-1",
      category: "telemetry",
      severity: "high",
      title: "Test finding",
      description: "A test finding",
      evidenceIds: ["ev-1"],
    }
    ctx.addFinding(f)
    expect(ctx.findings).toHaveLength(1)
    expect(ctx.findings[0]).toEqual(f)
  })

  it("getEvidenceByType filters correctly", () => {
    ctx.addEvidence({ id: "ev-1", type: "endpoint", value: "url1", confidence: 0.9 })
    ctx.addEvidence({ id: "ev-2", type: "killswitch", value: "ks1", confidence: 0.8 })
    ctx.addEvidence({ id: "ev-3", type: "endpoint", value: "url2", confidence: 0.7 })

    const endpoints = ctx.getEvidenceByType("endpoint")
    expect(endpoints).toHaveLength(2)
    expect(endpoints.every((e) => e.type === "endpoint")).toBe(true)

    const killswitches = ctx.getEvidenceByType("killswitch")
    expect(killswitches).toHaveLength(1)
  })

  it("getFindingsByCategory filters correctly", () => {
    ctx.addFinding({
      id: "f-1",
      category: "telemetry",
      severity: "high",
      title: "T1",
      description: "desc",
      evidenceIds: [],
    })
    ctx.addFinding({
      id: "f-2",
      category: "remote_control",
      severity: "medium",
      title: "T2",
      description: "desc",
      evidenceIds: [],
    })
    ctx.addFinding({
      id: "f-3",
      category: "telemetry",
      severity: "low",
      title: "T3",
      description: "desc",
      evidenceIds: [],
    })

    const telemetry = ctx.getFindingsByCategory("telemetry")
    expect(telemetry).toHaveLength(2)

    const rc = ctx.getFindingsByCategory("remote_control")
    expect(rc).toHaveLength(1)

    const network = ctx.getFindingsByCategory("network")
    expect(network).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 2. Target Loader
// ---------------------------------------------------------------------------
describe("loadTarget", () => {
  it("loads a directory and counts files", () => {
    const target = loadTarget(FIXTURES_DIR)
    expect(target.path).toBe(FIXTURES_DIR)
    // Should find at least the .ts and .json files we created
    expect(target.files.length).toBeGreaterThanOrEqual(3)
    expect(target.totalLines).toBeGreaterThan(0)
  })

  it("detects toolName and toolVersion from package.json", () => {
    const target = loadTarget(FIXTURES_DIR)
    expect(target.toolName).toBe("fake-ai-tool")
    expect(target.toolVersion).toBe("1.2.3")
  })

  it("throws for non-existent path", () => {
    expect(() => loadTarget("/nonexistent/path/xyz123")).toThrow()
  })
})

// ---------------------------------------------------------------------------
// 3. Scoring
// ---------------------------------------------------------------------------
describe("computeAuditScore", () => {
  it("returns grade A when no findings exist", () => {
    const ctx = new AuditContext("/tmp/fake", "")
    const result = computeAuditScore(ctx)
    expect(result.overall.grade).toBe("A")
    expect(result.overall.score).toBe(100)
  })

  it("penalizes for high-severity findings", () => {
    const ctx = new AuditContext("/tmp/fake", "")
    ctx.addFinding({
      id: "f-1",
      category: "telemetry",
      severity: "high",
      title: "Undeactivatable telemetry detected",
      description: "desc",
      evidenceIds: [],
    })
    const result = computeAuditScore(ctx)
    // severity penalty (high=15) + specific penalty ("undeactivatable telemetry"=15) = 30 off 100 => 70
    expect(result.categories.telemetry.score).toBe(70)
    expect(result.categories.telemetry.grade).toBe("C")
    // overall is weighted: telemetry weight=0.3, telemetry score=70, all others=100
    expect(result.overall.score).toBeLessThan(100)
  })

  it("penalizes for critical-severity findings", () => {
    const ctx = new AuditContext("/tmp/fake", "")
    ctx.addFinding({
      id: "f-1",
      category: "remote_control",
      severity: "critical",
      title: "Accept-or-die force update",
      description: "desc",
      evidenceIds: [],
    })
    const result = computeAuditScore(ctx)
    // severity penalty (critical=30) + specific penalty ("accept-or-die"=20) = 50 off 100 => 50
    expect(result.categories.remote_control.score).toBe(50)
    expect(result.categories.remote_control.grade).toBe("D")
  })

  it("clamps score to 0 at minimum", () => {
    const ctx = new AuditContext("/tmp/fake", "")
    // Add many critical findings to drive score below 0
    for (let i = 0; i < 5; i++) {
      ctx.addFinding({
        id: `f-${i}`,
        category: "telemetry",
        severity: "critical",
        title: `Critical issue ${i}`,
        description: "desc",
        evidenceIds: [],
      })
    }
    const result = computeAuditScore(ctx)
    expect(result.categories.telemetry.score).toBe(0)
    expect(result.categories.telemetry.grade).toBe("F")
  })
})

// ---------------------------------------------------------------------------
// 4. Full audit pipeline
// ---------------------------------------------------------------------------
describe("runAudit", () => {
  it("runs against fixture directory and produces a valid report", async () => {
    const report = await runAudit(FIXTURES_DIR, {
      kbRoot: "",
      analyzers: ["telemetry", "remote-control"],
    })

    expect(report.tool).toBe("fake-ai-tool")
    expect(report.version).toBe("1.2.3")
    expect(report.auditDate).toBeTruthy()
    expect(typeof report.overallScore).toBe("number")
    expect(["A", "B", "C", "D", "F"]).toContain(report.overallGrade)
    expect(report.metadata.analyzersRun.length).toBeGreaterThanOrEqual(2)
    expect(report.metadata.duration).toBeGreaterThanOrEqual(0)
  })

  it("detects telemetry endpoints in fixture files", async () => {
    const report = await runAudit(FIXTURES_DIR, {
      kbRoot: "",
      analyzers: ["telemetry"],
    })

    // The fixture has telemetry URLs and Sentry SDK references
    const telemetryFindings = report.findings.filter((f) => f.category === "telemetry")
    expect(telemetryFindings.length).toBeGreaterThan(0)
    expect(report.evidence.length).toBeGreaterThan(0)
  })

  it("detects remote control patterns in fixture files", async () => {
    const report = await runAudit(FIXTURES_DIR, {
      kbRoot: "",
      analyzers: ["remote-control"],
    })

    const rcFindings = report.findings.filter((f) => f.category === "remote_control")
    expect(rcFindings.length).toBeGreaterThan(0)
  })

  it("includes recommendations derived from findings", async () => {
    const report = await runAudit(FIXTURES_DIR, {
      kbRoot: "",
      analyzers: ["telemetry"],
    })

    // Findings with recommendations should propagate
    if (report.findings.some((f) => f.recommendation)) {
      expect(report.recommendations.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// 5. Reporters
// ---------------------------------------------------------------------------
describe("Reporters", () => {
  function makeReport(): AuditReport {
    const categories = {} as Record<FindingCategory, CategoryScore>
    const allCats: FindingCategory[] = [
      "telemetry",
      "remote_control",
      "permissions",
      "network",
      "privacy",
      "undercover",
      "hidden_features",
    ]
    for (const cat of allCats) {
      categories[cat] = {
        grade: "A" as Grade,
        score: 100,
        issueCount: 0,
        findings: [],
      }
    }
    categories.telemetry = {
      grade: "C",
      score: 70,
      issueCount: 1,
      findings: [
        {
          id: "f-1",
          category: "telemetry",
          severity: "high",
          title: "Undeactivatable telemetry detected",
          description: "Found telemetry endpoints with no opt-out.",
          evidenceIds: ["ev-1"],
          recommendation: "Provide a clear opt-out mechanism.",
        },
      ],
    }
    return {
      tool: "test-tool",
      version: "1.0.0",
      auditDate: "2026-04-01T00:00:00.000Z",
      overallGrade: "B",
      overallScore: 85,
      categories,
      findings: categories.telemetry.findings,
      evidence: [
        {
          id: "ev-1",
          type: "endpoint",
          value: "https://telemetry.example.com/v1/events",
          confidence: 0.9,
        },
      ],
      recommendations: ["Provide a clear opt-out mechanism."],
      metadata: {
        engineVersion: "1.0.0",
        kbVersion: "1.0.0",
        analyzersRun: ["telemetry"],
        duration: 42,
      },
    }
  }

  describe("formatJson", () => {
    it("returns valid JSON", () => {
      const report = makeReport()
      const json = formatJson(report)
      const parsed = JSON.parse(json)
      expect(parsed.tool).toBe("test-tool")
      expect(parsed.overallScore).toBe(85)
      expect(parsed.findings).toHaveLength(1)
    })
  })

  describe("formatMarkdown", () => {
    it("contains expected headers", () => {
      const report = makeReport()
      const md = formatMarkdown(report)
      expect(md).toContain("# Audit Report: test-tool")
      expect(md).toContain("## Summary")
      expect(md).toContain("## Category Breakdown")
      expect(md).toContain("## Findings")
      expect(md).toContain("## Recommendations")
    })

    it("contains finding details", () => {
      const report = makeReport()
      const md = formatMarkdown(report)
      expect(md).toContain("Undeactivatable telemetry detected")
      expect(md).toContain("Provide a clear opt-out mechanism")
    })

    it("contains the category table", () => {
      const report = makeReport()
      const md = formatMarkdown(report)
      expect(md).toContain("| Category | Grade | Score | Issues |")
      expect(md).toContain("Telemetry")
    })
  })

  describe("formatTerminal", () => {
    it("contains ANSI escape codes", () => {
      const report = makeReport()
      const terminal = formatTerminal(report)
      // ANSI escape sequences start with \x1b[
      expect(terminal).toContain("\x1b[")
    })

    it("contains the grade badge", () => {
      const report = makeReport()
      const terminal = formatTerminal(report)
      expect(terminal).toContain("AUDIT GRADE")
      expect(terminal).toContain("B")
      expect(terminal).toContain("85/100")
    })

    it("contains tool name", () => {
      const report = makeReport()
      const terminal = formatTerminal(report)
      expect(terminal).toContain("test-tool")
    })
  })
})
