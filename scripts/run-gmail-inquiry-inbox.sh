#!/bin/zsh
set -u

REPO="/Users/isibasidaisuke/wajo-notion-workers"
LOG_DIR="/tmp/wajo-gmail-inquiry"
LOCK_DIR="/tmp/wajo-gmail-inquiry.lock"
LOG_FILE="$LOG_DIR/run.log"
ERR_FILE="$LOG_DIR/run.err"
NODE_BIN="/Users/isibasidaisuke/.nvm/versions/node/v24.15.0/bin"

mkdir -p "$LOG_DIR"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') skipped: previous run still active" >> "$LOG_FILE"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

cd "$REPO" || exit 1

export NOTION_KEYRING=0
export PATH="$NODE_BIN:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

echo "$(date '+%Y-%m-%d %H:%M:%S') start processGmailInquiryInbox" >> "$LOG_FILE"

if "$NODE_BIN/npx" ntn workers exec \
  --worker-id 019e452d-22e7-7de1-b5ea-432a297bb478 \
  processGmailInquiryInbox \
  -d '{"dryRun":false,"limit":20,"query":"newer_than:30d","sourceLabelName":"問い合わせ","doneLabelName":"INQUIRY_DONE","removeSourceLabel":true,"linkCompany":false}' \
  >> "$LOG_FILE" 2>> "$ERR_FILE"; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') done" >> "$LOG_FILE"
else
  exit_code=$?
  echo "$(date '+%Y-%m-%d %H:%M:%S') failed: exit $exit_code" >> "$ERR_FILE"
  exit "$exit_code"
fi
