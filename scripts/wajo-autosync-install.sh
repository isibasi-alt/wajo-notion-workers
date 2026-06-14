#!/bin/zsh
# WAJO 2台自動同期：このMacに自動同期を導入する（どちらのMacでも実行可・1回だけ）
# 使い方： zsh ~/wajo-notion-workers/scripts/wajo-autosync-install.sh
set -e

REPO="$HOME/wajo-notion-workers"
SRC="$REPO/scripts/wajo-autosync.sh"
PLIST="$HOME/Library/LaunchAgents/com.wajo.autosync.plist"

chmod +x "$SRC"

cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.wajo.autosync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>$SRC</string>
  </array>
  <key>StartInterval</key><integer>120</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>/tmp/wajo-autosync.log</string>
  <key>StandardErrorPath</key><string>/tmp/wajo-autosync.err</string>
</dict>
</plist>
PLISTEOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

if launchctl list 2>/dev/null | grep -q wajo.autosync; then
  echo "✅ 自動同期：導入・起動 完了（$(scutil --get ComputerName)）"
else
  echo "❌ 起動できず"
fi
