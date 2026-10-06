# 0005 — Files are correct when written; no AI repair

**Date:** 2026-10-05 · **Status:** Accepted · **Commits:** 261cd4d

## Context
"AI Mend" and "Deep Mend File" asked a model to rewrite a broken line as
`Name [Points]` — so on a line the app had deliberately left unpriced, they
invented the very cost the app had declined to guess. The GM: making something
broken and repairing it on the fly is the wrong approach.

## Decision
Every path that writes a file writes it correctly by construction. **Format is
enforced; rules stay advisory** (0002). The repair tools are removed and must
not return in another form. A line the app cannot read is shown with the
reason and an *Edit* button — the GM settles it.

## Consequences
- The wizard, chat drafts, gear and the editors all render lines in code from
  structured choices.
- Old-format campaigns are converted once by the GM, not by an app importer
  (0012).
