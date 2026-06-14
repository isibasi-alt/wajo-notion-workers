#!/bin/zsh
# WAJO 2台自動同期 v2（リポジトリ同梱・両Mac共通）
# 役割：wajo-notion-workers を2台のMacで揃え続ける。
# 安全策：直近90秒に変更があったファイル＝編集中とみなし、本人の作業を勝手にコミットしない（掴み事故の再発防止）。
# これはコードを揃えるだけ。本番デプロイ(ntn workers deploy)は別の手動操作。AI・課金は一切使わない。

REPO="$HOME/wajo-notion-workers"
BR="tdb-fetcher-integration"

cd "$REPO" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

git fetch origin -q 2>/dev/null || exit 0

# デバウンス：直近90秒に変更されたファイルがあれば「誰か編集中」とみなす
HOT=$(find . -path ./.git -prune -o -type f -newermt '-90 seconds' -print 2>/dev/null | head -1)

if [ -n "$HOT" ]; then
  # 編集中：本人の作業を絶対に掴まない。手元がきれいな時だけ安全に早送り取り込み。
  if [ -z "$(git status --porcelain)" ]; then
    git merge --ff-only -q "origin/$BR" 2>/dev/null
  fi
  exit 0
fi

# 落ち着いている：確定した変更を送る
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -q -m "autosync $(scutil --get ComputerName 2>/dev/null) $(date '+%m-%d %H:%M')" 2>/dev/null || true
fi

if ! git merge --no-edit -q "origin/$BR" 2>/dev/null; then
  git merge --abort 2>/dev/null
  osascript -e 'display notification "2台が同じ箇所を同時に編集して衝突。片方で直して声をかけて。" with title "WAJO同期 ⚠ 要対応"' 2>/dev/null
  exit 0
fi

git push -q origin "$BR" 2>/dev/null || true
