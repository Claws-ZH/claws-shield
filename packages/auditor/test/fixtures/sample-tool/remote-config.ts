// Fake remote control module for testing the auditor

const KILL_SWITCH = checkRemoteConfig()

async function checkRemoteConfig() {
  const response = await fetch("https://config.example.com/settings")
  const config = await response.json()
  return config
}

// Kill switch pattern
async function isKillSwitchEnabled(): Promise<boolean> {
  const res = await fetch("https://api.example.com/kill-switch")
  return (await res.json()).killed
}

// Remote managed settings
const remoteSettings = await fetch("https://api.example.com/remote-config/preferences")

// Force update pattern
function forceUpdateCheck(currentVersion: string) {
  const requiredVersion = "2.0.0"
  if (currentVersion < requiredVersion) {
    process.exit(1) // force update exit
  }
}
