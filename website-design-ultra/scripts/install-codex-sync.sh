#!/bin/zsh

set -euo pipefail

wdu_script_dir="${0:A:h}"
wdu_source_script="${wdu_script_dir}/sync-codex-marketplace.sh"
wdu_user_home="${HOME:?HOME is required}"
wdu_support_dir="${wdu_user_home}/Library/Application Support/WebsiteDesignUltra"
wdu_installed_script="${wdu_support_dir}/sync-codex-marketplace.sh"
wdu_launch_agents_dir="${wdu_user_home}/Library/LaunchAgents"
wdu_plist_path="${wdu_launch_agents_dir}/com.kay.website-design-ultra-sync.plist"
wdu_log_path="${wdu_user_home}/Library/Logs/website-design-ultra-sync.log"
wdu_error_log_path="${wdu_user_home}/Library/Logs/website-design-ultra-sync.error.log"
wdu_codex_bin="${WDU_CODEX_BIN:-/Applications/ChatGPT.app/Contents/Resources/codex}"
wdu_user_id="$(id -u)"
wdu_launch_domain="gui/${wdu_user_id}"
wdu_launch_label="com.kay.website-design-ultra-sync"

if [[ ! -f "$wdu_source_script" ]]; then
  print -u2 "website-design-ultra sync installer: missing $wdu_source_script"
  exit 1
fi

if [[ ! -x "$wdu_codex_bin" ]]; then
  wdu_codex_bin="$(command -v codex 2>/dev/null || true)"
fi

if [[ -z "$wdu_codex_bin" || ! -x "$wdu_codex_bin" ]]; then
  print -u2 "website-design-ultra sync installer: Codex executable not found"
  exit 1
fi

mkdir -p "$wdu_support_dir" "$wdu_launch_agents_dir" "${wdu_user_home}/Library/Logs"
install -m 0755 "$wdu_source_script" "$wdu_installed_script"

cat > "$wdu_plist_path" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${wdu_launch_label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${wdu_installed_script}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>WDU_CODEX_BIN</key>
    <string>${wdu_codex_bin}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>3600</integer>
  <key>StandardOutPath</key>
  <string>${wdu_log_path}</string>
  <key>StandardErrorPath</key>
  <string>${wdu_error_log_path}</string>
</dict>
</plist>
PLIST

plutil -lint "$wdu_plist_path"
launchctl bootout "$wdu_launch_domain" "$wdu_plist_path" >/dev/null 2>&1 || true
launchctl bootstrap "$wdu_launch_domain" "$wdu_plist_path"
launchctl kickstart -k "${wdu_launch_domain}/${wdu_launch_label}"

print "Installed ${wdu_launch_label}"
print "Schedule: at load and every 3600 seconds"
print "Log: ${wdu_log_path}"
