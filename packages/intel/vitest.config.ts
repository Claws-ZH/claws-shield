import { defineProject } from "vitest/config"

export default defineProject({
  test: {
    name: "intel",
    globals: true,
    environment: "node",
  },
})
