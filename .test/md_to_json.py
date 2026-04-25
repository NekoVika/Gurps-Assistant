import os
import sys
import json
import shutil
import re

def get_empty_character():
    return {
        "name": "", "concept": "", "significance": "", "role": "",
        "location": "", "status": "", "appearance": "", "personality": "",
        "motivation": "", "speech": "", "pointTotal": "",
        "attributes": [], "advantages": [], "disadvantages": [], "skills": [],
        "gear": [], "tactics": "", "hitLocations": "", "pcHooks": "",
        "gmSummary": "", "images": [], "variations": []
    }

def get_empty_location():
    return {
        "name": "", "type": "", "region": "", "techLevel": "",
        "manaLevel": "", "images": [], "overview": "", "landmarks": [],
        "internalStructure": [], "factions": [], "notableNpcs": [], "plotHooks": []
    }

def get_empty_story():
    return {
        "title": "", "type": "Story", "status": "", "primaryLocation": "",
        "images": [], "gmBrief": "", "premise": "", "objectives": "",
        "stakesAndAntagonists": "", "mechanicsAndHazards": "", "cluesAndProps": "",
        "rewards": "", "mainOutline": "", "branchingPath": "", "childLinks": "",
        "outcomes": "", "pcHooks": "", "assumptions": "", "openQuestions": ""
    }

def extract_meta(content, field_name):
    match = re.search(rf"\*\*(?:{field_name}):\*\*\s*(.+)", content, re.IGNORECASE)
    return match.group(1).strip() if match else ""

def extract_blob_fuzzy(content, section_title_regex):
    pattern = rf"(?:^|\n)##(?:\s*\d+\S*\s*|\s+)(?:{section_title_regex})[^\n]*\n([\s\S]*?)(?:\n##|$)"
    match = re.search(pattern, content, re.IGNORECASE)
    if not match:
        return ""
    text = match.group(1).strip()
    text = re.sub(r"^\*\([^)]+\)\*\s*\n*", "", text)
    return text.strip()

def extract_list_fuzzy(content, section_title_regex):
    blob = extract_blob_fuzzy(content, section_title_regex)
    if not blob:
        return []
    lines = []
    for line in blob.split("\n"):
        line = line.strip()
        if line.startswith("* ") or line.startswith("- "):
            lines.append(line[2:].strip())
    return lines

def extract_inline_list(blob, header_regex):
    pattern = rf"\*\*(?:{header_regex}):\*\*\s*\n([\s\S]*?)(?:\n\*\*|$)"
    match = re.search(pattern, blob, re.IGNORECASE)
    if not match:
        return []
    lines = []
    for line in match.group(1).strip().split("\n"):
        line = line.strip()
        if line.startswith("* ") or line.startswith("- "):
            lines.append(line[2:].strip())
    return lines

def convert_md_file(src_path, dest_path):
    with open(src_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    filename = os.path.basename(src_path)
    base_name = os.path.splitext(filename)[0]
    
    images = []
    img_matches = re.finditer(r"!\[.*?\]\((.*?)\)", content)
    for m in img_matches:
        images.append(m.group(1).strip())
    cleaned_content = re.sub(r"!\[.*?\]\(.*?\)", "", content).strip()

    normalized_path = src_path.replace("\\", "/")

    if "02_Characters" in normalized_path or "Bestiary" in normalized_path:
        data = get_empty_character()
        title_match = re.search(r"^#\s+(.*)", cleaned_content, re.MULTILINE)
        title = title_match.group(1).strip() if title_match else base_name
        
        parts = title.split("-", 1)
        data["name"] = parts[0].replace("(pts)", "").strip()
        data["concept"] = parts[1].strip() if len(parts) > 1 else ""
        data["role"] = extract_meta(cleaned_content, "Role")
        data["location"] = extract_meta(cleaned_content, "Location")
        data["status"] = extract_meta(cleaned_content, "Status")
        data["images"] = images
        
        # Fuzzy parsing for characters
        narrative = extract_blob_fuzzy(cleaned_content, "Narrative & Roleplay|Backstory & Personality")
        if narrative:
            data["appearance"] = "\n".join(extract_inline_list(narrative, "Appearance") or [l for l in narrative.split("\n") if "Appearance" in l])
            data["personality"] = "\n".join([l for l in narrative.split("\n") if "Personality" in l or "Backstory" in l])
        
        stats = extract_blob_fuzzy(cleaned_content, "GURPS 4e Statistics|Statistics")
        data["attributes"] = extract_inline_list(stats, "Attributes")
        data["advantages"] = extract_inline_list(stats, "Advantages & Perks|Advantages")
        data["disadvantages"] = extract_inline_list(stats, "Disadvantages & Quirks|Disadvantages")
        data["skills"] = extract_inline_list(stats, "Skills")
        
        data["gear"] = extract_list_fuzzy(cleaned_content, "Gear & Weapons|Equipment")
        data["tactics"] = extract_blob_fuzzy(cleaned_content, "Tactics & Combat Style|Tactics")
        data["pcHooks"] = extract_blob_fuzzy(cleaned_content, "PC Hooks")
        data["gmSummary"] = extract_blob_fuzzy(cleaned_content, "GM Summary.*")
        
        out_path = dest_path[:-3] + ".json"
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
    elif "01_World_Bible/Locations" in normalized_path:
        data = get_empty_location()
        title_match = re.search(r"^#\s+(?:Location:\s*)?(.+)$", cleaned_content, re.MULTILINE)
        data["name"] = title_match.group(1).strip() if title_match else "Unknown Location"
        
        data["type"] = extract_meta(cleaned_content, "Type")
        data["region"] = extract_meta(cleaned_content, "Region")
        data["techLevel"] = extract_meta(cleaned_content, "Tech Level")
        data["manaLevel"] = extract_meta(cleaned_content, "Mana Level")
        data["images"] = images
        
        data["overview"] = extract_blob_fuzzy(cleaned_content, "Overview")
        data["landmarks"] = extract_list_fuzzy(cleaned_content, "Key Landmarks")
        data["factions"] = extract_list_fuzzy(cleaned_content, "Factions")
        data["notableNpcs"] = extract_list_fuzzy(cleaned_content, "Notable NPCs")
        data["plotHooks"] = extract_list_fuzzy(cleaned_content, "Plot Hooks")
        
        internal_match = re.search(r"##(?:\s*\d+\.\s*)?Internal Structure(.*?)(?:\n##\s+|$)", cleaned_content, re.IGNORECASE | re.DOTALL)
        if internal_match:
            internal_block = internal_match.group(1)
            sections = re.split(r"\n###\s+", internal_block)
            for section in sections[1:]:
                lines = section.strip().split("\n")
                if lines:
                    title = lines[0].strip()
                    items = [l[2:].strip() for l in lines[1:] if l.strip().startswith("* ") or l.strip().startswith("- ")]
                    data["internalStructure"].append({"title": title, "items": items})
                    
        out_path = dest_path[:-3] + ".json"
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    elif "03_Story" in normalized_path:
        data = get_empty_story()
        title_match = re.search(r"^#\s+(?:Episode:|Chapter:|Encounter:)?\s*(.+)$", cleaned_content, re.MULTILINE)
        data["title"] = title_match.group(1).strip() if title_match else "Unknown Story Part"
        data["images"] = images
        
        if re.search(r"^#\s+Episode:", cleaned_content, re.IGNORECASE):
            data["type"] = "Episode"
        elif re.search(r"^#\s+Chapter:", cleaned_content, re.IGNORECASE):
            data["type"] = "Chapter"
        elif re.search(r"^#\s+Encounter:", cleaned_content, re.IGNORECASE):
            data["type"] = "Encounter"
        else:
            data["type"] = "Story"
            
        data["status"] = extract_meta(cleaned_content, "Status")
        data["primaryLocation"] = extract_meta(cleaned_content, "Primary Setting") or extract_meta(cleaned_content, "Primary Location\\(s\\)") or extract_meta(cleaned_content, "Location")
        
        data["gmBrief"] = extract_blob_fuzzy(cleaned_content, "GM Brief|GM Summary|GM Summary \\(preserved.*\\)")
        data["premise"] = extract_blob_fuzzy(cleaned_content, "Premise & Setup|Starting Situation & Purpose|Scene Setup")
        data["objectives"] = extract_blob_fuzzy(cleaned_content, "Main Objectives|Key Objectives|Objectives")
        data["stakesAndAntagonists"] = extract_blob_fuzzy(cleaned_content, "Key Antagonists & Figures|Stakes & Time Pressure|Participants|Notable NPCs.*")
        data["mechanicsAndHazards"] = extract_blob_fuzzy(cleaned_content, "Key Mechanics & Skill Checks")
        data["cluesAndProps"] = extract_blob_fuzzy(cleaned_content, "Clues & Props")
        data["rewards"] = extract_blob_fuzzy(cleaned_content, "Loot & Rewards")
        data["pcHooks"] = extract_blob_fuzzy(cleaned_content, "PC Hooks")
        data["outcomes"] = extract_blob_fuzzy(cleaned_content, "Resolution & Consequences|Outcomes")
        
        qa_blob = extract_blob_fuzzy(cleaned_content, "Assumptions & Open Questions")
        if qa_blob:
            assump_match = re.search(r"\*\*((?:Assumptions):)\*\*(.*?)(?=\*\*(?:Open Questions):|$)", qa_blob, re.IGNORECASE | re.DOTALL)
            if assump_match:
                data["assumptions"] = assump_match.group(2).strip()
            open_match = re.search(r"\*\*((?:Open Questions):)\*\*(.*?)$", qa_blob, re.IGNORECASE | re.DOTALL)
            if open_match:
                data["openQuestions"] = open_match.group(2).strip()
                
        data["mainOutline"] = extract_blob_fuzzy(cleaned_content, "Detailed Story Outline|Beat Outline \\(Main Path\\)|Beat Outline")
        data["branchingPath"] = extract_blob_fuzzy(cleaned_content, "Variant / Branching Path \\(Optional\\)")
        data["childLinks"] = extract_blob_fuzzy(cleaned_content, "Chapter Index|Encounters & Scenes")
        
        out_path = dest_path[:-3] + ".json"
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    else:
        shutil.copy2(src_path, dest_path)

def migrate_campaign(src_dir, dest_dir):
    if not os.path.exists(dest_dir):
        os.makedirs(dest_dir)
        
    print(f"Migrating {src_dir} -> {dest_dir}")
    
    for root, dirs, files in os.walk(src_dir):
        rel_path = os.path.relpath(root, src_dir)
        dest_root = os.path.join(dest_dir, rel_path)
        if not os.path.exists(dest_root):
            os.makedirs(dest_root)
            
        for file in files:
            src_file = os.path.join(root, file)
            dest_file = os.path.join(dest_root, file)
            
            if file.endswith(".md"):
                convert_md_file(src_file, dest_file)
            else:
                shutil.copy2(src_file, dest_file)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python md_to_json.py <src_campaign_dir> <dest_campaign_dir>")
        sys.exit(1)
        
    src_campaign = sys.argv[1]
    dest_campaign = sys.argv[2]
    
    if not os.path.exists(src_campaign):
        print(f"Error: Source directory '{src_campaign}' does not exist.")
        sys.exit(1)
        
    migrate_campaign(src_campaign, dest_campaign)
    print("Done! Check your new JSON campaign.")
