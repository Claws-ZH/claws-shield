import type { FindingCategory } from "../types/finding.js"

export const AUDIT_CATEGORY_WEIGHTS: Record<FindingCategory, number> = {
	telemetry: 0.3,
	remote_control: 0.25,
	permissions: 0.15,
	network: 0.15,
	undercover: 0.15,
	privacy: 0,
	hidden_features: 0,
}

export const SEVERITY_PENALTIES = {
	critical: 30,
	high: 15,
	medium: 7,
	low: 3,
	info: 0,
} as const

export const SPECIFIC_PENALTIES = {
	undeactivatable_telemetry: 15,
	third_party_log_export: 8,
	device_fingerprinting: 8,
	full_tool_input_logging: 10,
	remote_managed_settings: 10,
	accept_or_die_kill_path: 20,
	hidden_feature_flags: 6,
	undercover_mode: 10,
	ai_attribution_stripping: 8,
} as const
