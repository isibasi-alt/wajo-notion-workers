# Monthly Evaluation PDF Fonts

This directory bundles Noto Sans JP subset fonts for `attachMonthlyEvalPdfWebhook`.

- Source font: Noto Sans CJK JP Regular/Bold
- License: SIL Open Font License 1.1 (`LICENSE.txt`)
- Subset coverage: ASCII, Latin-1, Japanese punctuation, Hiragana, Katakana, full-width forms, CJK compatibility forms, and Joyo kanji codepoints.
- Purpose: keep the Worker bundle small while avoiding macOS-only font paths in production.

Regenerate with `fonttools pyftsubset` from the upstream Noto Sans CJK JP OTF files if the coverage needs to expand.
