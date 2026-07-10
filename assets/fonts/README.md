# WAJO PDF Fonts

This directory bundles M+ 1p Regular/Bold TrueType fonts for every Worker-generated Japanese PDF.

- Source font: M+ 1p Regular/Bold
- License: SIL Open Font License 1.1 (`LICENSE.txt`)
- Coverage: Japanese, Latin, numerals, punctuation, and full-width forms used by the Sales OS documents.
- Purpose: use a TrueType font that embeds reliably in Notion's PDF viewer and avoid macOS-only font paths in production.

The older Noto CFF subset is kept only as a historical asset until the production PDF visual check is complete. New PDF generation resolves M+ 1p first.
