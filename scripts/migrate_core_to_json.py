import os
import json
import re

def migrate_state(campaign_dir):
    state_md_path = os.path.join(campaign_dir, "state.md")
    state_json_path = os.path.join(campaign_dir, "state.json")
    
    if not os.path.exists(state_md_path):
        print("No state.md found.")
        return

    with open(state_md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Very naive extraction, typically state.md has headings.
    # We will just put everything in recentEvents for now, or attempt to split it.
    
    state_data = {
        "currentChapter": "",
        "inGameDate": "",
        "recentEvents": content,
        "activeQuests": "",
        "partyStatus": "",
        "flags": [],
        "gmNotes": []
    }

    # Extract some basic info if possible
    chapter_match = re.search(r'\*\*Current Chapter\*\*:\s*(.*)', content)
    if chapter_match:
        state_data["currentChapter"] = chapter_match.group(1).strip()
        
    date_match = re.search(r'\*\*Date\*\*:\s*(.*)', content)
    if date_match:
        state_data["inGameDate"] = date_match.group(1).strip()

    with open(state_json_path, 'w', encoding='utf-8') as f:
        json.dump(state_data, f, indent=2)
    
    print(f"Migrated state.md to state.json")

def migrate_system_rules(campaign_dir):
    rules_md_path = os.path.join(campaign_dir, "00_System_Rules.md")
    rules_json_path = os.path.join(campaign_dir, "00_System_Rules.json")
    
    if not os.path.exists(rules_md_path):
        print("No 00_System_Rules.md found.")
        return

    with open(rules_md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    rules_data = {
        "corePrompt": "You are a GURPS AI Game Master Assistant.",
        "formattingRules": "",
        "mechanicsRules": content,
        "toneAndStyle": ""
    }

    with open(rules_json_path, 'w', encoding='utf-8') as f:
        json.dump(rules_data, f, indent=2)
    
    print(f"Migrated 00_System_Rules.md to 00_System_Rules.json")

if __name__ == "__main__":
    campaign_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Campaign")
    if os.path.exists(campaign_dir):
        migrate_state(campaign_dir)
        migrate_system_rules(campaign_dir)
    else:
        print(f"Campaign directory not found at {campaign_dir}")
