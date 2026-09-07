from pydantic import BaseModel, Field
from typing import List, Optional, Any, Literal

class InternalStructure(BaseModel):
    title: str = Field(..., description="Name of the internal zone or floor")
    items: List[str] = Field(default_factory=list, description="List of rooms or contents")

class RelationItem(BaseModel):
    name: str = Field(..., title="Target Name")
    relation: str = Field(..., title="Relationship Description")


class StoryPlacement(BaseModel):
    """Where an entity belongs in the story, and in what sense.

    `mode` distinguishes two relations that look alike and behave oppositely:

    - "appearance" -- the entity turns up at this specific node. Rolls *upward*
      only: appearing in an encounter means appearing in its chapter, but being
      in the chapter never implies being in any particular encounter.
    - "fixture" -- the entity is a standing presence *throughout* this node, so
      it is available in every descendant. The deliberate downward exception.

    Only one home is recorded. Further one-off appearances belong in
    `storyAppearances`, and something that is a fixture of two siblings really
    belongs to their common parent.
    """

    node: str = Field("", title="Story Node", description="Name of the episode, chapter or encounter. Empty means unplaced.")
    mode: Literal["appearance", "fixture"] = Field("appearance", title="Placement Mode")


class CharacterData(BaseModel):
    name: str = Field("Unknown Character", title="Name")
    kind: Literal["individual", "type", "pc"] = Field("individual", title="Kind",
        description="individual: one person. type: a template instantiated many times (a bestiary entry) "
        "-- exempt from placement, because instances are placed and templates are not. pc: a player character. "
        "This field is authoritative; folder placement is derived from it, never the other way round.")
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
    characterRelations: List[RelationItem] = Field(default_factory=list, title="Character Relations")
    locationRelations: List[RelationItem] = Field(default_factory=list, title="Location Relations")
    factionRelations: List[RelationItem] = Field(default_factory=list, title="Faction Relations")
    storyPlacement: StoryPlacement = Field(default_factory=StoryPlacement, title="Story Placement")
    storyAppearances: List[str] = Field(default_factory=list, title="Story Appearances")
    
    tactics: str = Field("", title="Tactics & Combat Style")
    hitLocations: List[str] = Field(default_factory=list, title="Hit Locations", description="List of strings formatted EXACTLY as 'Location (Roll): DR X - Notes', e.g. 'Skull (3-4): DR 2 - Helmet'")
    pcHooks: str = Field("", title="PC Hooks")
    gmSummary: str = Field("", title="GM Summary (Raw Archive)")
    images: List[str] = Field(default_factory=list, title="Image Links")
    variations: List[str] = Field(default_factory=list, title="Variations")

class LocationData(BaseModel):
    name: str = Field("Unknown Location", title="Name")
    type: str = Field("", title="Type")
    storyPlacement: StoryPlacement = Field(default_factory=StoryPlacement, title="Story Placement")
    parentLocation: str = Field("", title="Parent Location", description="Name of the Location that contains this one. Empty means top level. Containment rolls upward only: being in a room implies being in the building, never the reverse.")
    region: str = Field("", title="Region", description="Human-readable label for where/when this sits. Not structural -- parentLocation carries containment.")
    techLevel: str = Field("", title="Tech Level")
    manaLevel: str = Field("", title="Mana Level")
    
    images: List[str] = Field(default_factory=list, title="Image Links")
    overview: str = Field("", title="Overview")
    landmarks: List[str] = Field(default_factory=list, title="Key Landmarks")
    
    internalStructure: List[InternalStructure] = Field(default_factory=list, title="Internal Structure")
    
    factions: List[str] = Field(default_factory=list, title="Factions")
    notableNpcs: List[str] = Field(default_factory=list, title="Notable NPCs")
    plotHooks: List[str] = Field(default_factory=list, title="Plot Hooks")
    characterRelations: List[RelationItem] = Field(default_factory=list, title="Character Relations")
    locationRelations: List[RelationItem] = Field(default_factory=list, title="Location Relations")
    factionRelations: List[RelationItem] = Field(default_factory=list, title="Faction Relations")
    storyAppearances: List[str] = Field(default_factory=list, title="Story Appearances")

class FactionData(BaseModel):
    name: str = Field("Unknown Faction", title="Name")
    type: str = Field("", title="Type")
    status: str = Field("", title="Status")
    headquarters: str = Field("", title="Headquarters")
    leader: str = Field("", title="Leader")
    allies: List[str] = Field(default_factory=list, title="Allies")
    enemies: List[str] = Field(default_factory=list, title="Enemies")
    overview: str = Field("", title="Overview")
    goals: str = Field("", title="Goals")
    assets: List[str] = Field(default_factory=list, title="Assets")
    notableMembers: List[str] = Field(default_factory=list, title="Notable Members")
    images: List[str] = Field(default_factory=list, title="Image Links")
    characterRelations: List[RelationItem] = Field(default_factory=list, title="Character Relations")
    locationRelations: List[RelationItem] = Field(default_factory=list, title="Location Relations")
    factionRelations: List[RelationItem] = Field(default_factory=list, title="Faction Relations")
    storyAppearances: List[str] = Field(default_factory=list, title="Story Appearances")

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
    
    childLinks: List[str] = Field(default_factory=list, title="Child Links (Chapters/Encounters)")

    outcomes: str = Field("", title="Outcomes")
    pcHooks: str = Field("", title="PC Hooks")
    assumptions: str = Field("", title="Assumptions")
    openQuestions: str = Field("", title="Open Questions")
    characters: List[str] = Field(default_factory=list, title="Characters")
    locations: List[str] = Field(default_factory=list, title="Locations")
    factions: List[str] = Field(default_factory=list, title="Factions")
