import json
import os

def format_attribute(attr):
    if isinstance(attr, str):
        if attr.strip().startswith("{") and attr.strip().endswith("}"):
            try:
                attr = json.loads(attr)
            except:
                return attr
        else:
            return attr
    if isinstance(attr, dict):
        return f"{attr.get('name', '')} {attr.get('level', '')} [{attr.get('points', '0')}]"
    return attr

def format_trait(trait):
    if isinstance(trait, str):
        if trait.strip().startswith("{") and trait.strip().endswith("}"):
            try:
                trait = json.loads(trait)
            except:
                return trait
        else:
            return trait
    if isinstance(trait, dict):
        s = f"{trait.get('name', '')} [{trait.get('points', '0')}]"
        notes = trait.get('notes', '')
        ref = trait.get('reference', '')
        if notes:
            s += f" - {notes}"
        if ref:
            s += f" ({ref})"
        return s
    return trait

def format_skill(skill):
    if isinstance(skill, str):
        if skill.strip().startswith("{") and skill.strip().endswith("}"):
            try:
                skill = json.loads(skill)
            except:
                return skill
        else:
            return skill
    if isinstance(skill, dict):
        s = f"{skill.get('name', '')} ({skill.get('base', '')})-{skill.get('level', '')} [{skill.get('points', '0')}]"
        notes = skill.get('notes', '')
        if notes:
            s += f" - {notes}"
        return s
    return skill

def format_gear(gear):
    if isinstance(gear, str):
        if gear.strip().startswith("{") and gear.strip().endswith("}"):
            try:
                gear = json.loads(gear)
            except:
                return gear
        else:
            return gear
    if isinstance(gear, dict):
        s = f"{gear.get('name', '')}"
        qty = gear.get('quantity', 1)
        if qty != 1 and str(qty) != "1":
            s += f" [{qty}]"
        s += f" ({gear.get('weight', '0 lbs')}, {gear.get('cost', '$0')})"
        notes = gear.get('notes', '')
        if notes:
            s += f" - {notes}"
        return s
    return gear

def format_hit_location(hl):
    if isinstance(hl, str):
        if hl.strip().startswith("{") and hl.strip().endswith("}"):
            try:
                hl = json.loads(hl)
            except:
                return hl
        else:
            return hl
    if isinstance(hl, dict):
        s = f"{hl.get('location', '')} ({hl.get('roll', '')}): DR {hl.get('dr', '0')}"
        notes = hl.get('notes', '')
        if notes:
            s += f" - {notes}"
        return s
    return hl

def fix_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        return

    changed = False

    if 'attributes' in data and isinstance(data['attributes'], list):
        new_attrs = [format_attribute(x) for x in data['attributes']]
        if new_attrs != data['attributes']:
            data['attributes'] = new_attrs
            changed = True

    for key in ['advantages', 'disadvantages']:
        if key in data and isinstance(data[key], list):
            new_traits = [format_trait(x) for x in data[key]]
            if new_traits != data[key]:
                data[key] = new_traits
                changed = True

    if 'skills' in data and isinstance(data['skills'], list):
        new_skills = [format_skill(x) for x in data['skills']]
        if new_skills != data['skills']:
            data['skills'] = new_skills
            changed = True

    if 'gear' in data and isinstance(data['gear'], list):
        new_gear = [format_gear(x) for x in data['gear']]
        if new_gear != data['gear']:
            data['gear'] = new_gear
            changed = True

    if 'hitLocations' in data and isinstance(data['hitLocations'], list):
        new_hls = [format_hit_location(x) for x in data['hitLocations']]
        if new_hls != data['hitLocations']:
            data['hitLocations'] = new_hls
            changed = True

    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Fixed: {filepath}")

count = 0
for root, _, files in os.walk('AnomalyHuntersCampaign'):
    for file in files:
        if file.endswith('.json'):
            fix_file(os.path.join(root, file))
            count += 1

print(f"Checked {count} files.")
