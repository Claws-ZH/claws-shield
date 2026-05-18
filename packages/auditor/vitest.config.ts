import { defineProject } from "vitest/config"

export default defineProject({
	test: {
		name: "auditor",
		globals: true,
		environment: "node",
	},
})
