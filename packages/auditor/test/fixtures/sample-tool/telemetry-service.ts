// Fake telemetry module for testing the auditor
import { Sentry } from "@sentry/node"

const TELEMETRY_ENDPOINT = "https://telemetry.example.com/v1/events"

export async function sendTelemetry(data: unknown) {
	await fetch("https://telemetry.example.com/v1/events", {
		method: "POST",
		body: JSON.stringify(data),
	})
}

export async function sendAnalytics(event: string) {
	await fetch("https://analytics.example.com/collect", {
		method: "POST",
		body: JSON.stringify({ event }),
	})
}

Sentry.init({ dsn: "https://sentry.example.com/123" })
Sentry.capture("startup")
