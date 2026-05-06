import { describe, expect, it } from "vitest"
import { scoreToGrade } from "../src/scoring/grade.js"

describe("scoreToGrade", () => {
	it("returns A for scores 90-100", () => {
		expect(scoreToGrade(100)).toBe("A")
		expect(scoreToGrade(95)).toBe("A")
		expect(scoreToGrade(90)).toBe("A")
	})

	it("returns B for scores 80-89", () => {
		expect(scoreToGrade(89)).toBe("B")
		expect(scoreToGrade(80)).toBe("B")
	})

	it("returns C for scores 65-79", () => {
		expect(scoreToGrade(79)).toBe("C")
		expect(scoreToGrade(65)).toBe("C")
	})

	it("returns D for scores 50-64", () => {
		expect(scoreToGrade(64)).toBe("D")
		expect(scoreToGrade(50)).toBe("D")
	})

	it("returns F for scores below 50", () => {
		expect(scoreToGrade(49)).toBe("F")
		expect(scoreToGrade(0)).toBe("F")
	})

	it("clamps out-of-range scores", () => {
		expect(scoreToGrade(150)).toBe("A")
		expect(scoreToGrade(-10)).toBe("F")
	})
})
