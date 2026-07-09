# GurpsAI — Map Index

This file is the **root router** for all structural maps in this project. It points to the three specialized maps based on task type.

## Which Map to Read

| Task | Map to Load |
|------|-------------|
| Creating or finding campaign content (NPCs, Locations, Episodes, Encounters, Factions) | → **[CAMPAIGN_MAP.md](CAMPAIGN_MAP.md)** |
| Working on the application (backend routes, frontend components, services, scripts) | → **[APP_MAP.md](APP_MAP.md)** |
| Finding AI system files (personas, workflows, philosophy docs, templates) | → **[SYSTEM_MAP.md](SYSTEM_MAP.md)** |

---

## Quick Reference: Repository Root

```text
GurpsAI/
├── .agents/                 # AI personas and workflow definitions
│   ├── skills/              # Dev persona skills (Antigravity SKILL.md format)
│   └── workflows/           # Slash-command workflow procedures
├── .planning/               # Architectural truth and blueprints
│   ├── MAP.md               # [THIS FILE] Router to all three maps
│   ├── CAMPAIGN_MAP.md      # Campaign folder taxonomy (where entities live)
│   ├── APP_MAP.md           # Application codebase structure
│   ├── SYSTEM_MAP.md        # AI system file index
│   └── _templates/          # Blank JSON templates for campaign entities
├── src/gurpsai/             # Python FastAPI backend package
├── web/                     # React/Vite/TypeScript frontend
├── scripts/                 # CLI tools, rulesdb pipeline, migration utilities
├── rules_db/                # GURPS Basic Set SQLite database
├── tests/                   # Python test suite
├── AnomalyHuntersCampaign/  # Dev example: full Anomaly Hunters campaign data
├── Campaign/                # Legacy dev reference (secondary example)
├── AGENTS.md                # Universal AI entrypoint
├── SYSTEM.md                # GMing system instructions
├── master_philosophy.md     # GMing + project philosophy
├── APP_SYSTEM.md            # App features and UI system instructions
└── APP_PHILOSOPHY.md        # App design philosophy
```
