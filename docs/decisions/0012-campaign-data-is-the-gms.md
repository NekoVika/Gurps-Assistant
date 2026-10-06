# 0012 — Campaign data is the GM's; no legacy importer

**Date:** 2026-10-05 · **Status:** Accepted

## Decision
Campaign folders belong to the GM and are gitignored. The app fixes data *with*
the GM, never behind them, and any check that writes compares against a backup
afterwards rather than grepping for the change it expected. Old-format
campaigns are converted once by the GM with a strong model — the app does not
get an importer for them.

## Consequences
- Damaged data in the campaign — 15 skill lines in the six bestiary sheets, 90
  dead `.md` references in prose — is the GM's to fix; the app reports it.
