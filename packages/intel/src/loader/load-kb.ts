import { findKBRoot, loadKBFile } from "@claws-shield/core"

export interface IntelDatabase {
	telemetryEndpoints: any[]
	metadataFields: any
	eventTypes: any
	featureFlags: any[]
	killswitches: any[]
	codenames: any[]
	managedSettings: any[]
	overrideCapabilities: any
	undercoverRules: any[]
	promptSignatures: any
	unreleasedTools: any[]
	privacyGrading: any
	securityGrading: any
}

export function loadIntelDatabase(kbRoot?: string): IntelDatabase {
	const root = kbRoot ?? findKBRoot()
	return {
		telemetryEndpoints: loadKBFile(root, "telemetry/endpoints.json"),
		metadataFields: loadKBFile(root, "telemetry/metadata-fields.json"),
		eventTypes: loadKBFile(root, "telemetry/event-types.json"),
		featureFlags: loadKBFile(root, "flags/feature-flags.json"),
		killswitches: loadKBFile(root, "flags/killswitches.json"),
		codenames: loadKBFile(root, "codenames/models.json"),
		managedSettings: loadKBFile(root, "remote-control/managed-settings.json"),
		overrideCapabilities: loadKBFile(root, "remote-control/override-capabilities.json"),
		undercoverRules: loadKBFile(root, "undercover/activation-rules.json"),
		promptSignatures: loadKBFile(root, "undercover/prompt-signatures.json"),
		unreleasedTools: loadKBFile(root, "hidden-features/unreleased-tools.json"),
		privacyGrading: loadKBFile(root, "baselines/privacy-grading.json"),
		securityGrading: loadKBFile(root, "baselines/security-grading.json"),
	}
}
