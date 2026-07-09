from __future__ import annotations

import logging
from pathlib import Path

from gurpsai.app.config import load_app_config, ROOT
from gurpsai.app.prompts import build_gm_base, get_persona_overlay

# Campaign files that carry dynamic runtime data and are injected per-request.
# These are the GM's actual campaign data — read from the user's campaign folder.
# Static GMing identity is now in src/gurpsai/app/prompts/ (not read from disk).
_DYNAMIC_CAMPAIGN_FILES = [
    Path("state.json"),
    Path("System_Rules.json"),
]

# Soft character-count ceiling for the assembled system prompt.
# The file tree is truncated when this limit would be exceeded.
# ~120,000 chars ≈ ~30,000 tokens — well within Gemini Flash/Pro context windows.
# Increase this if you regularly use models with very large context limits.
_MAX_CONTEXT_CHARS = 120_000


def _resolve_campaign_root() -> Path:
    """Return the absolute path to the active campaign folder."""
    config = load_app_config()
    active_path = config.campaign.active_path.strip()
    if active_path:
        p = Path(active_path)
        return p if p.is_absolute() else (ROOT / active_path).resolve()
    return (ROOT / "Campaign").resolve()


class ContextService:
    def build_system_prompt(self, *, persona: str | None = None) -> str:
        """
        Assemble the full system prompt for the in-app GM AI.

        Sections (in order):
          1. Static GM identity and prime directives (from prompts module)
          2. Optional persona overlay (KingCrab / Marauder / Atlas / Archer)
          3. Dynamic campaign data: state.json + System_Rules.json
          4. Available workspace file tree (truncated if budget exceeded)
          5. AI tooling instructions (read_file, query_rules, draft_file)
        """
        parts: list[str] = []

        # --- 1. Static GM identity ---
        parts.append(build_gm_base())

        # --- 2. Persona overlay (optional) ---
        if persona:
            overlay = get_persona_overlay(persona)
            if overlay:
                parts.append(f"\n\n{overlay}")
            else:
                logging.warning("ContextService: unknown persona %r — no overlay applied.", persona)

        # --- 3. Dynamic campaign data ---
        camp_root = _resolve_campaign_root()
        for rel_path in _DYNAMIC_CAMPAIGN_FILES:
            full_path = camp_root / rel_path
            if not full_path.exists():
                logging.warning(
                    "ContextService: campaign file missing: %s — skipping injection.",
                    full_path,
                )
                continue
            try:
                content = full_path.read_text(encoding="utf-8")
                parts.append(
                    f"\n\n--- BEGIN {rel_path.name} ---\n{content}\n--- END {rel_path.name} ---"
                )
            except Exception as exc:
                logging.error("ContextService: failed to read %s: %s", full_path, exc)

        # --- 4. Available workspace file tree (with budget guard) ---
        try:
            from gurpsai.app.services.files import CampaignFileService

            def _flatten(node) -> list[str]:
                if node.node_type == "file":
                    return [node.path]
                paths: list[str] = []
                for child in node.children:
                    paths.extend(_flatten(child))
                return paths

            all_paths = []
            for node in CampaignFileService().tree():
                all_paths.extend(_flatten(node))

            # Measure what we've built so far to apply the budget guard.
            current_chars = sum(len(p) for p in parts)
            remaining_budget = _MAX_CONTEXT_CHARS - current_chars

            paths_str = "\n".join(all_paths)
            file_tree_section = (
                f"\n\n--- AVAILABLE WORKSPACE FILES ---\n{paths_str}\n"
                "You can use the read_file tool on any of these files to fetch content."
            )

            if len(file_tree_section) <= remaining_budget:
                parts.append(file_tree_section)
            else:
                # Truncate the file list to fit within the remaining budget.
                # Reserve chars for the header/footer so we always emit a usable section.
                header = "\n\n--- AVAILABLE WORKSPACE FILES (truncated — budget limit reached) ---\n"
                footer = (
                    "\n[...additional files omitted to stay within context budget...]\n"
                    "You can still use the read_file tool with any valid campaign path."
                )
                available_for_paths = remaining_budget - len(header) - len(footer)
                if available_for_paths > 0:
                    truncated = paths_str[:available_for_paths]
                    # Trim to the last complete line to avoid a broken path.
                    last_newline = truncated.rfind("\n")
                    if last_newline > 0:
                        truncated = truncated[:last_newline]
                    parts.append(header + truncated + footer)
                else:
                    # No budget left for paths at all — emit a minimal notice.
                    parts.append(
                        "\n\n--- AVAILABLE WORKSPACE FILES ---\n"
                        "[File tree omitted — context budget exhausted. "
                        "Use the read_file tool with known campaign paths.]\n"
                    )
                logging.warning(
                    "ContextService: file tree truncated — system prompt exceeded %d chars budget.",
                    _MAX_CONTEXT_CHARS,
                )
        except Exception as exc:
            logging.error("ContextService: failed to inject file tree: %s", exc)

        # --- 5. AI tooling instructions ---
        parts.append(
            "\n\n--- AI CAPABILITIES & TOOLING ---\n"
            "You are equipped with a suite of tools to manage the campaign:\n"
            "- read_file: Use this to read the current content of any file, including templates.\n"
            "- query_rules: Use this to search the GURPS 4e Rules Database. Always do this before answering mechanical questions to get exact page numbers.\n"
            "- draft_file: Use this to propose new or updated files. The UI will present this to the GM for review.\n\n"
            "CRITICAL TEMPLATE BEHAVIOUR: If the GM asks you to create or fix a file using a "
            "template, you MUST first use the read_file tool to fetch the corresponding "
            "template from .planning/_templates/ in AVAILABLE WORKSPACE FILES. "
            "Do NOT hallucinate the template format."
        )

        return "\n".join(parts).strip()
