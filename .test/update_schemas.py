import json
import os
import sys

# Add the project root to sys.path so we can import src
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.gurpsai.domain.campaign import (
    CharacterData, LocationData, StoryData, InternalStructure
)

base_path = os.path.join(os.path.dirname(__file__), '..', '.planning', '_templates')

def save_example(model_instance, filename, desc):
    data = model_instance.model_dump()
    data = {'_INSTRUCTION': desc, **data}
    filepath = os.path.join(base_path, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

char_example = CharacterData(
    name="Example Character Name",
    concept="A brief high-level concept",
    significance="Major/Minor NPC or Boss",
    role="Their role in the narrative",
    location="Where they are typically found",
    status="Alive, Dead, or Missing",
    appearance="Physical description...",
    personality="Personality traits and demeanor...",
    motivation="What drives them...",
    speech="A characteristic quote...",
    pointTotal="150",
    attributes=[
        "ST 10 [0]",
        "DX 12 [40]",
        "IQ 10 [0]",
        "HT 10 [0]",
        "HP 10 [0]",
        "Will 10 [0]",
        "Per 10 [0]",
        "FP 10 [0]",
        "Basic Speed 5.50 [0]",
        "Basic Move 5 [0]"
    ],
    advantages=[
        "Combat Reflexes [15] - Reacts quickly (B43)"
    ],
    disadvantages=[
        "Curious [-5] - CR: 12 (B129)"
    ],
    skills=[
        "Brawling (DX+1)-13 [2] - Punching"
    ],
    gear=[
        "Broadsword [1] (3 lbs, $500) - sw+1 cut"
    ],
    tactics="Preferred combat methods...",
    hitLocations=[
        "Eye (-): DR 0",
        "Skull (3-4): DR 2 - Helmet",
        "Face (5): DR 0",
        "Right Leg (6-7): DR 0",
        "Right Arm (8): DR 0",
        "Torso (9-10): DR 0",
        "Groin (11): DR 0",
        "Left Arm (12): DR 0",
        "Left Leg (13-14): DR 0",
        "Hand (15): DR 0",
        "Foot (16): DR 0",
        "Neck (17-18): DR 0",
        "Vitals (-): DR 0"
    ],
    pcHooks="How the PCs might interact with them...",
    gmSummary="Hidden GM notes and secrets...",
    images=["avatar.png"],
    variations=["Optional variant notes..."]
)

loc_example = LocationData(
    name="Example Location Name",
    type="City, Dungeon, Building",
    region="Geographic region",
    techLevel="TL8",
    manaLevel="Normal",
    images=["map.png"],
    overview="General description of the location...",
    landmarks=["Landmark 1", "Landmark 2"],
    internalStructure=[
        InternalStructure(title="Ground Floor", items=["Main Hall", "Kitchen"]),
        InternalStructure(title="Basement", items=["Dungeon Cells", "Armory"])
    ],
    factions=["Local Militia", "Thieves Guild"],
    notableNpcs=["Mayor Bob", "Guard Captain Jane"],
    plotHooks=["A mysterious artifact was found here..."]
)

story_example = StoryData(
    title="Example Title",
    type="Episode",
    status="Draft or Active",
    primaryLocation="Main setting",
    images=["scene.png"],
    gmBrief="Secret GM summary of what really happens...",
    premise="Starting situation and setup...",
    objectives="What the PCs need to achieve...",
    stakesAndAntagonists="Who opposes them and what happens if they fail...",
    mechanicsAndHazards="Key skill checks or environmental dangers...",
    cluesAndProps="Information to uncover...",
    rewards="Loot, points, or favors...",
    mainOutline="Beat 1: ...\nBeat 2: ...",
    branchingPath="If the PCs do X instead of Y...",
    childLinks="Links to Encounters or Chapters...",
    outcomes="Success/Failure results...",
    pcHooks="Why the party cares...",
    assumptions="What you assume the PCs will do...",
    openQuestions="Things you still need to prep..."
)

save_example(
    char_example, 
    'NPC_Template.json', 
    'CRITICAL AI INSTRUCTION: This is an EXAMPLE JSON for Characters. DO NOT output a JSON schema. Output a valid JSON object that perfectly mimics this exact structure and depth, keeping all arrays as arrays of objects.'
)

save_example(
    loc_example, 
    'Location_Template.json', 
    'CRITICAL AI INSTRUCTION: This is an EXAMPLE JSON for Locations. DO NOT output a JSON schema. Output a valid JSON object that perfectly mimics this exact structure and depth.'
)

save_example(
    story_example, 
    'Story_Template.json', 
    'CRITICAL AI INSTRUCTION: This is an EXAMPLE JSON for Story elements. DO NOT output a JSON schema. Output a valid JSON object that perfectly mimics this exact structure and depth.'
)

print("Example payload templates successfully generated!")
