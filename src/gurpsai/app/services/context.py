from __future__ import annotations

import logging
from pathlib import Path

from gurpsai.app.config import load_app_config, ROOT

REQUIRED_CONTEXT_FILES = [
    Path("Campaign/state.md"),
    Path("SYSTEM.md"),
    Path("master_philosophy.md"),
    Path(".planning/MAP.md"),
    Path("Campaign/00_System_Rules.md"),
]



class ContextService:
    def build_system_prompt(self) -> str:
        prompt_parts = []
        
        config = load_app_config()
        active_path = config.campaign.active_path.strip()
        if active_path:
            camp_path_base = Path(active_path)
            if not camp_path_base.is_absolute():
                camp_path_base = (ROOT / active_path).resolve()
        else:
            camp_path_base = (ROOT / "Campaign").resolve()
            
        for rel_path in REQUIRED_CONTEXT_FILES:
            if rel_path.parts[0] == "Campaign":
                subpath = rel_path.relative_to("Campaign")
                full_path = camp_path_base / subpath
            else:
                full_path = ROOT / rel_path
                
            if not full_path.exists():
                raise RuntimeError(
                    f"Required context file missing: {full_path}. "
                    "This indicates the campaign INIT phase was skipped or the workspace is broken. "
                    "Please run the init workflows."
                )
            
            try:
                content = full_path.read_text(encoding="utf-8")
                header = f"\n\n--- BEGIN {rel_path.name} ---\n"
                footer = f"\n--- END {rel_path.name} ---\n"
                prompt_parts.append(f"{header}{content}{footer}")
            except Exception as e:
                raise RuntimeError(f"Failed to read context file {full_path}: {e}") from e

        # Inject File Tree
        try:
            from gurpsai.app.services.files import CampaignFileService
            service = CampaignFileService()
            tree = service.tree()
            
            def flatten_tree(node):
                if node.node_type == "file":
                    return [node.path]
                paths = []
                for child in node.children:
                    paths.extend(flatten_tree(child))
                return paths
                
            all_paths = []
            for n in tree:
                all_paths.extend(flatten_tree(n))
                
            paths_str = "\n".join(all_paths)
            prompt_parts.append(f"\n\n--- AVAILABLE WORKSPACE FILES ---\n{paths_str}\nYou can use <read path=\"...\" /> on any of these files to fetch content.")
        except Exception as e:
            logging.error(f"Failed to inject file tree: {e}")

        prompt_parts.append(
            "\n\n--- AI CAPABILITIES & TOOLING ---\n"
            "You are equipped with a powerful File Editor built directly into the Chat UI.\n"
            "If you need to edit an existing file, create a new file, or rewrite a campaign file, you MUST propose a draft using a specialized markdown block format.\n"
            "When the UI detects this block, it will intercept it and present a visual diff for the Game Master to officially review and Apply to their disk.\n\n"
            "To propose an edit to a file, output exactly this exact standard structure, and NOTHING ELSE in front of the tags:\n"
            "<draft path=\"Campaign/path/to/file.ext\">\n"
            "[ENTIRE BRAND NEW FILE CONTENT HERE. DO NOT TRUNCATE OR USE PLACEHOLDERS.]\n"
            "</draft>\n\n"
            "CRITICAL: The `path` attribute MUST start with `Campaign/` if you are modifying user campaign files. You MUST output the ENTIRE file content. Do not output snippet patches.\n\n"
            "If you need to read the current contents of a file before editing it to gain context, or if you need to read a file to answer a user's question, output exactly this standard structure on its own line:\n"
            "<read path=\"Campaign/path/to/file.ext\" />\n"
            "Do not output anything else after this tag. Wait for the system to provide the file content before proposing a draft or continuing your answer.\n\n"
            "If you need to recall or verify GURPS rules (e.g. looking up an advantage, spell, combat mechanic, etc.), you can query the Rules Database by outputting exactly this structure on its own line:\n"
            "<query_rules query=\"Your search query here\" />\n"
            "Do not output anything else after this tag. Wait for the system to provide the rules context before continuing your response.\n\n"
            "CRITICAL TEMPLATE BEHAVIOR: If the Game Master asks you to create, format, or 'fix' a file according to a standard or template, you MUST first use `<read path=\"...\" />` to fetch the corresponding template file from the `AVAILABLE WORKSPACE FILES` (usually stored in `.planning/_templates/`). DO NOT hallucinate the template format from your pre-training."
        )

        return "".join(prompt_parts).strip()
