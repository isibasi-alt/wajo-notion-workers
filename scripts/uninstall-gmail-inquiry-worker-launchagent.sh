#!/bin/zsh
# Gmail問い合わせWorkerの5分ごと起動を止める。
set -e

PLIST="$HOME/Library/LaunchAgents/com.wajo.gmail-inquiry-worker.plist"

launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"

echo "gmail inquiry worker launchagent uninstalled"
