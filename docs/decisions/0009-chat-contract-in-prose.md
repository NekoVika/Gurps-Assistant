# 0009 — The chat assistant's build contract is prose, not a tool schema

**Date:** 2026-10-05 · **Status:** Accepted · **Commits:** feb918e

## Context
Characters drafted in chat could be held to the build shape by a dedicated
`draft_character` tool with an enforced schema. A tool's schema is sent with
every chat turn — about 1.5k tokens — and most GMs are on free tiers.

## Decision
`draft_file` describes the build shape in its text, and the review panel prices
what the model sends before the GM sees the diff. Lines the model priced itself
are listed on a banner. A test pins every build field into the description.

## Revisit when
Models are seen ignoring the contract often enough that the banner is the norm
rather than the exception.
