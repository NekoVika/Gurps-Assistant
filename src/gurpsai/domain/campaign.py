from pydantic import BaseModel, Field
from typing import List, Optional, Any

class InternalStructure(BaseModel):
    title: str = Field(..., description="Name of the internal zone or floor")
    items: List[str] = Field(default_factory=list, description="List of rooms or contents")


class CharacterData(BaseModel):
    name: str = Field("Unknown Character", title="Name")
    concept: str = Field("", title="Concept")
    significance: str = Field("", title="Significance")
    role: str = Field("", title="Role")
    location: str = Field("", title="Location")
    locations: List[Any] = Field(default_factory=list, title="Locations")
    status: str = Field("", title="Status")
    
    appearance: str = Field("", title="Appearance")
    personality: str = Field("", title="Personality & Quirks")
    motivation: str = Field("", title="Motivation")
    speech: str = Field("", title="Speech Snippet")

    pointTotal: str = Field("???", title="Point Total")
    attributes: List[str] = Field(default_factory=list, title="Attributes", description="List of strings formatted EXACTLY as 'Name Level [Points]', e.g. 'ST 10 [0]'")
    advantages: List[str] = Field(default_factory=list, title="Advantages & Perks", description="List of strings formatted EXACTLY as 'Name [Points] - Notes (Reference)', e.g. 'Combat Reflexes [15] - Reacts quickly (B43)'")
    disadvantages: List[str] = Field(default_factory=list, title="Disadvantages & Quirks", description="List of strings formatted EXACTLY as 'Name [Points] - Notes (Reference)'")
    skills: List[str] = Field(default_factory=list, title="Skills", description="List of strings formatted EXACTLY as 'Name (Base)-Level [Points] - Notes', e.g. 'Brawling (DX+1)-13 [2] - Punching'")
    gear: List[str] = Field(default_factory=list, title="Gear & Weapons", description="List of strings formatted EXACTLY as 'Name [Qty] (Weight, Cost) - Notes', e.g. 'Broadsword [1] (3 lbs, $500) - sw+1 cut'")
    relations: List[Any] = Field(default_factory=list, title="Relations")
    appearances: List[str] = Field(default_factory=list, title="Appearances")
    
    tactics: str = Field("", title="Tactics & Combat Style")
    hitLocations: List[str] = Field(default_factory=list, title="Hit Locations", description="List of strings formatted EXACTLY as 'Location (Roll): DR X - Notes', e.g. 'Skull (3-4): DR 2 - Helmet'")
    pcHooks: str = Field("", title="PC Hooks")
    gmSummary: str = Field("", title="GM Summary (Raw Archive)")
    images: List[str] = Field(default_factory=list, title="Image Links")
    variations: List[str] = Field(default_factory=list, title="Variations")

class LocationData(BaseModel):
    name: str = Field("Unknown Location", title="Name")
    type: str = Field("", title="Type")
    region: str = Field("", title="Region")
    techLevel: str = Field("", title="Tech Level")
    manaLevel: str = Field("", title="Mana Level")
    
    images: List[str] = Field(default_factory=list, title="Image Links")
    overview: str = Field("", title="Overview")
    landmarks: List[str] = Field(default_factory=list, title="Key Landmarks")
    
    internalStructure: List[InternalStructure] = Field(default_factory=list, title="Internal Structure")
    
    factions: List[str] = Field(default_factory=list, title="Factions")
    notableNpcs: List[str] = Field(default_factory=list, title="Notable NPCs")
    plotHooks: List[str] = Field(default_factory=list, title="Plot Hooks")

class StoryData(BaseModel):
    title: str = Field("Unknown Story Part", title="Title")
    type: str = Field("Story", title="Type (Episode/Chapter/Encounter)")
    status: str = Field("", title="Status")
    primaryLocation: str = Field("", title="Primary Location")
    images: List[str] = Field(default_factory=list, title="Image Links")

    gmBrief: str = Field("", title="GM Brief")
    premise: str = Field("", title="Premise & Setup")
    objectives: str = Field("", title="Objectives")
    
    stakesAndAntagonists: str = Field("", title="Stakes & Antagonists")
    mechanicsAndHazards: str = Field("", title="Mechanics & Hazards")
    cluesAndProps: str = Field("", title="Clues & Props")
    rewards: str = Field("", title="Rewards")

    mainOutline: str = Field("", title="Main Outline")
    branchingPath: str = Field("", title="Branching Path")
    
    childLinks: str = Field("", title="Child Links (Chapters/Encounters)")

    outcomes: str = Field("", title="Outcomes")
    pcHooks: str = Field("", title="PC Hooks")
    assumptions: str = Field("", title="Assumptions")
    openQuestions: str = Field("", title="Open Questions")
