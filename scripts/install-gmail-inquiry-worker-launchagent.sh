#!/bin/zsh
# Gmail問い合わせWorkerだけを5分ごとに起動するLaunchAgentを導入する。
# Codex/AIは起動しない。実行対象は processGmailInquiryInbox のみ。
set -e

REPO="/Users/isibasidaisuke/wajo-notion-workers"
RUNNER="$REPO/scripts/run-gmail-inquiry-inbox.sh"
PLIST="$HOME/Library/LaunchAgents/com.wajo.gmail-inquiry-worker.plist"
LOG_DIR="/tmp/wajo-gmail-inquiry"

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
chmod +x "$RUNNER"

cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.wajo.gmail-inquiry-worker</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>$RUNNER</string>
  </array>
  <key>StartInterval</key><integer>300</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG_DIR/launchd.out</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/launchd.err</string>
</dict>
</plist>
PLISTEOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

if launchctl list 2>/dev/null | grep -q "com.wajo.gmail-inquiry-worker"; then
  echo "gmail inquiry worker launchagent installed"
else
  echo "gmail inquiry worker launchagent install failed" >&2
  exit 1
fi
