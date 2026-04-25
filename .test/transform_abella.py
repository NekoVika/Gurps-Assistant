import json
import re

filepath = r"c:\Users\VikA\Documents\RPG\AnomalyHunter_v2\AnomalyHuntersCampaign\02_Characters\Main_Cast\Abella.json"

with open(filepath, "r", encoding="utf-8") as f:
    data = json.load(f)

# The DR table is currently in her tactics block.
tactics = data.get("tactics", "")
hit_locations = []

if "| Hit Location (Roll) |" in tactics:
    lines = tactics.split("\n")
    new_tactics = []
    parsing_table = False
    
    for line in lines:
        if "| Hit Location (Roll) |" in line:
            parsing_table = True
            continue
        if parsing_table and "| :---" in line:
            continue
        if parsing_table and line.strip() == "":
            parsing_table = False
            continue
        
        if parsing_table and "|" in line:
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 4:
                # e.g., "| Eye (3-4) | 0 | |"
                # parts = ["", "Eye (3-4)", "0", "", ""]
                loc_col = parts[1]
                dr_col = parts[2]
                notes_col = parts[3]
                
                # Extract roll and location
                m = re.search(r"(.+?)\s*\((\d+(?:-\d+)?)\)", loc_col)
                if m:
                    loc_name = m.group(1).strip()
                    roll_str = m.group(2).strip()
                else:
                    loc_name = loc_col
                    roll_str = ""
                    
                dr_val = 0
                try:
                    dr_val = int(dr_col)
                except:
                    pass
                    
                hit_locations.append({
                    "roll": roll_str,
                    "location": loc_name,
                    "dr": dr_val,
                    "notes": notes_col
                })
        else:
            new_tactics.append(line)
            
    data["tactics"] = "\n".join(new_tactics).strip()

data["hitLocations"] = hit_locations

with open(filepath, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

print("Abella Hit Locations structured successfully.")
