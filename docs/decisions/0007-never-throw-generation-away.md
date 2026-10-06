# 0007 — Generation is applied as far as it reads, never discarded

**Date:** 2026-10-05 · **Status:** Accepted · **Commits:** acf6523, d12aceb, feb918e

## Context
Enforcing format (0005) could mean refusing a whole generated character for one
malformed field. Most GMs are on free tiers of hosted models, so a refused
generation costs them a call.

## Decision
Apply whatever reads, keep the rest, and report it for the GM to decide. A
build that fails its own validation is passed through as sent and priced as far
as it goes. A chat-draft line the model priced itself is listed on a banner:
never silently trusted, never silently dropped.
