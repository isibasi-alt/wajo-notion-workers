# .telemetry/

このフォルダは WAJO Sales OS のテレメトリ設計成果物を格納する。

## 構成

| ファイル | 内容 | 生成フェーズ |
|---|---|---|
| `product.md` | プロダクトモデル（何をするか / 誰が使うか / 価値の流れ）| model |
| `audits/` | 現状トラッキング監査（何がすでに追跡されているか）| audit |
| `plan.md` | 目標トラッキング設計（何を追跡すべきか）| design |
| `guide.md` | 実装ガイド（どう入れるか）| guide |

## ライフサイクル

```
model → audit → design → guide → implement ← feature updates
  ↑
```

## 現状

- **product.md**: 2026-07-03 作成（監査役 Claude Code セッション）
- **audits/**: 未作成
- **plan.md**: 未作成
- **guide.md**: 未作成

## Next Phase

`product-tracking-audit-current-tracking` スキルで現状トラッキング監査（audit）に進む。
