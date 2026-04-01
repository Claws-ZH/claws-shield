export type Severity = "critical" | "high" | "medium" | "low" | "info"
export type Grade = "A" | "B" | "C" | "D" | "F"
export type ReportFormat = "json" | "markdown" | "terminal" | "sarif"

export interface GradeBand {
  min: number
  max: number
}

export const GRADE_BANDS: Record<Grade, GradeBand> = {
  A: { min: 90, max: 100 },
  B: { min: 80, max: 89 },
  C: { min: 65, max: 79 },
  D: { min: 50, max: 64 },
  F: { min: 0, max: 49 },
}
