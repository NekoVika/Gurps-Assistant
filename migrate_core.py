import json
import os
import sys
from pathlib import Path

# Add src to path so we can import gurpsai
sys.path.insert(0, str(Path("src").resolve()))

from gurpsai.app.services.providers import ProviderService
from gurpsai.providers.base import ChatMessage as ProviderChatMessage
from gurpsai.app.config import load_app_config

def migrate_file(md_path_str, template_path_str):
    md_path = Path(md_path_str)
    template_path = Path(template_path_str)
    
    if not md_path.exists():
        print(f"Skipping {md_path}, does not exist.")
        return
        
    if not template_path.exists():
        print(f"Template {template_path} does not exist!")
        return

    print(f"Migrating {md_path} using {template_path}...")
    
    raw_content = md_path.read_text(encoding="utf-8")
    schema_str = template_path.read_text(encoding="utf-8")
    
    system_prompt = (
        "You are an expert strict JSON formatting engine for a GURPS RPG campaign manager. "
        "The user will provide you with a malformed, corrupted, or badly formatted text file that was "
        "supposed to be a valid JSON object. Your ONLY job is to extract all the available information and "
        "rewrite it into a perfectly valid JSON object that strictly conforms to the provided JSON Schema or Template.\n\n"
        f"JSON TEMPLATE/SCHEMA:\n{schema_str}\n\n"
        "CRITICAL INSTRUCTIONS:\n"
        "1. Output ONLY the raw JSON string. Do not include markdown formatting like ```json or any introductory text.\n"
        "2. Ensure all required fields from the template are present. If data is missing, provide a sensible default (e.g., empty string or empty array).\n"
        "3. Do not invent new facts, but map existing text creatively into the closest matching schema field."
    )

    config = load_app_config()
    active_model = config.defaults.mending_model or "gemini-1.5-flash"
    active_provider = config.defaults.mending_provider or "gemini"

    try:
        provider = ProviderService().get_provider(active_provider)
        result = provider.chat(
            messages=[
                ProviderChatMessage(role="system", content=system_prompt),
                ProviderChatMessage(role="user", content=f"Fix this file content:\n{raw_content}")
            ],
            model=active_model
        )
    except Exception as exc:
        print(f"Failed to mend {md_path}: {exc}")
        return

    raw_text = result.text.strip()
    
    start_idx = raw_text.find('{')
    end_idx = raw_text.rfind('}')
    if start_idx != -1 and end_idx != -1 and end_idx >= start_idx:
        raw_text = raw_text[start_idx:end_idx+1]

    try:
        json.loads(raw_text)
    except json.JSONDecodeError as exc:
        print(f"Output for {md_path} was not valid JSON: {exc}\n{raw_text}")
        return

    json_path = md_path.with_suffix('.json')
    json_path.write_text(raw_text, encoding="utf-8")
    
    # Backup original
    backup_path = md_path.with_suffix('.md.bak')
    md_path.rename(backup_path)
    print(f"Successfully migrated {md_path} to {json_path} and backed up original.")

def main():
    mappings = [
        ("AnomalyHuntersCampaign/state.md", ".planning/_templates/State_Template.json"),
        ("AnomalyHuntersCampaign/00_System_Rules.md", ".planning/_templates/System_Rules_Template.json"),
        ("AnomalyHuntersCampaign/01_World_Bible/World_Dossier.md", ".planning/_templates/World_Dossier_Template.json"),
        ("AnomalyHuntersCampaign/03_Story/Campaign_Overview.md", ".planning/_templates/Campaign_Overview_Template.json")
    ]
    
    for md_path, template_path in mappings:
        migrate_file(md_path, template_path)

if __name__ == "__main__":
    main()
