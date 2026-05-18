import { GRADE_BANDS, type Grade } from "../types/common.js"

export function scoreToGrade(score: number): Grade {
	const clamped = Math.max(0, Math.min(100, Math.round(score)))
	for (const [grade, band] of Object.entries(GRADE_BANDS) as [
		Grade,
		{ min: number; max: number },
	][]) {
		if (clamped >= band.min && clamped <= band.max) return grade
	}
	return "F"
}

export function gradeColor(grade: Grade): string {
	const colors: Record<Grade, string> = {
		A: "\x1b[32m", // green
		B: "\x1b[36m", // cyan
		C: "\x1b[33m", // yellow
		D: "\x1b[31m", // red
		F: "\x1b[35m", // magenta
	}
	return colors[grade]
}

export const RESET = "\x1b[0m"
