#!/bin/zsh
set -u

cd /Users/isibasidaisuke/wajo-notion-workers || exit 1

export NOTION_KEYRING=0
export PATH="/Users/isibasidaisuke/.nvm/versions/node/v24.15.0/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

exec /Users/isibasidaisuke/.nvm/versions/node/v24.15.0/bin/npx ntn workers exec \
  --worker-id 019e452d-22e7-7de1-b5ea-432a297bb478 \
  processGmailInquiryInbox \
  -d '{"dryRun":false,"limit":5,"query":"newer_than:7d","sourceLabelName":"","doneLabelName":"","removeSourceLabel":true,"linkCompany":false}'
