import type { ScanRule } from "@claws-shield/core"
import { suspiciousShellRule } from "./malware/suspicious-shell.js"
import { credentialHarvestRule } from "./malware/credential-harvest.js"
import { instructionOverrideRule } from "./prompt/instruction-override.js"
import { base64Rule } from "./obfuscation/base64.js"
import { charcodeRule } from "./obfuscation/charcode.js"
import { unsafePostinstallRule } from "./supply-chain/unsafe-postinstall.js"
import { envDumpRule } from "./exfil/env-dump.js"
import { outboundNetworkRule } from "./exfil/outbound-network.js"
import { multiSignalRule } from "./composition/multi-signal.js"

export function getAllRules(): ScanRule[] {
  return [
    suspiciousShellRule,
    credentialHarvestRule,
    instructionOverrideRule,
    base64Rule,
    charcodeRule,
    unsafePostinstallRule,
    envDumpRule,
    outboundNetworkRule,
    multiSignalRule,
  ]
}
